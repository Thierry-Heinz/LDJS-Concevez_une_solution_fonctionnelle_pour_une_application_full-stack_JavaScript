import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import type { AccountsService } from '../accounts/accounts.service';
import type { RefreshTokensRepository } from './refresh-tokens.repository';
import type {
  AccessTokenPayload,
  CreateRefreshTokenData,
  RefreshTokenPayload,
} from './auth.types';
import { Role } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'secret-acces-de-test',
  JWT_REFRESH_SECRET: 'secret-rafraichissement-de-test',
  JWT_GUEST_SECRET: 'secret-invite-de-test',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_IDLE_TTL_SECONDS: '3600',
  SESSION_ABSOLUTE_TTL_SECONDS: '10800',
  GUEST_TOKEN_TTL_SECONDS: '259200',
};

const PASSWORD = 'un_mot_de_passe_long';
const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'jean.dupont@example.com',
  role: Role.CUSTOMER,
  agencyId: null,
};

describe('AuthService', () => {
  let passwordHash: string;
  let jwt: JwtService;
  let accounts: {
    createCustomer: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
    getPasswordHash: jest.Mock;
  };
  let refreshTokens: {
    create: jest.Mock;
    findById: jest.Mock;
    revokeFamily: jest.Mock;
    revokeIfActive: jest.Mock;
  };
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(async () => {
    jwt = new JwtService({});
    accounts = {
      createCustomer: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      getPasswordHash: jest.fn(),
    };
    refreshTokens = {
      create: jest.fn(),
      findById: jest.fn(),
      revokeFamily: jest.fn(),
      revokeIfActive: jest.fn(),
    };
    const config = {
      getOrThrow: (key: string) => CONFIG[key],
    } as unknown as ConfigService;

    service = new AuthService(
      accounts as unknown as AccountsService,
      refreshTokens as unknown as RefreshTokensRepository,
      jwt,
      config,
    );
    await service.onModuleInit();
  });

  /** Connecte USER et renvoie le résultat ainsi que le jeton enregistré en base. */
  async function loginAsUser() {
    accounts.findByEmail.mockResolvedValue(USER);
    accounts.getPasswordHash.mockResolvedValue(passwordHash);
    const result = await service.login({
      email: USER.email,
      password: PASSWORD,
    });
    const [saved] = refreshTokens.create.mock.calls[0] as [
      CreateRefreshTokenData,
    ];
    refreshTokens.create.mockClear();
    return { result, saved: { ...saved, revokedAt: null } };
  }

  describe('register', () => {
    it('normalise l’e-mail et hache le mot de passe avant de créer le client', async () => {
      await service.register({
        email: '  Jean.Dupont@Example.COM ',
        password: PASSWORD,
        firstName: 'Jean',
        lastName: 'Dupont',
        birthDate: new Date('1990-05-12'),
        address: '12 rue de la République, 69002 Lyon',
      });

      const [data] = accounts.createCustomer.mock.calls[0] as [
        { email: string; passwordHash: string },
      ];
      expect(data.email).toBe('jean.dupont@example.com');
      expect(data.passwordHash).not.toBe(PASSWORD);
      await expect(argon2.verify(data.passwordHash, PASSWORD)).resolves.toBe(
        true,
      );
    });
  });

  describe('register avec un e-mail existant', () => {
    const dto = {
      email: USER.email,
      password: PASSWORD,
      firstName: 'Jean',
      lastName: 'Dupont',
      birthDate: new Date('1990-05-12'),
      address: '12 rue de la République, 69002 Lyon',
    };

    it('répond 409 EMAIL_ALREADY_USED quand la contrainte d’unicité est violée', async () => {
      accounts.createCustomer.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const error: unknown = await service
        .register(dto)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'EMAIL_ALREADY_USED',
      });
    });

    it('relance telle quelle une autre erreur de la base', async () => {
      const failure = new Error('connexion perdue');
      accounts.createCustomer.mockRejectedValue(failure);

      await expect(service.register(dto)).rejects.toBe(failure);
    });
  });

  describe('login', () => {
    it('ouvre une session : jetons signés et jeton de rafraîchissement haché en base', async () => {
      const { result, saved } = await loginAsUser();

      expect(result.user).toBe(USER);
      const access = await jwt.verifyAsync<AccessTokenPayload>(
        result.accessToken,
        { secret: CONFIG.JWT_ACCESS_SECRET },
      );
      expect(access).toMatchObject({
        sub: USER.id,
        role: Role.CUSTOMER,
        sid: saved.familyId,
        agencyId: null,
      });

      const refresh = await jwt.verifyAsync<RefreshTokenPayload>(
        result.refreshToken,
        { secret: CONFIG.JWT_REFRESH_SECRET },
      );
      expect(saved.id).toBe(refresh.jti);
      expect(saved.userId).toBe(USER.id);
      await expect(
        argon2.verify(saved.tokenHash, result.refreshToken),
      ).resolves.toBe(true);
      expect(saved.sessionExpiresAt.getTime()).toBeGreaterThanOrEqual(
        saved.expiresAt.getTime(),
      );
    });

    it('cherche le compte avec l’e-mail normalisé', async () => {
      accounts.findByEmail.mockResolvedValue(USER);
      accounts.getPasswordHash.mockResolvedValue(passwordHash);

      await service.login({
        email: ' JEAN.Dupont@example.com',
        password: PASSWORD,
      });

      expect(accounts.findByEmail).toHaveBeenCalledWith(USER.email);
    });

    it('refuse un mauvais mot de passe sans créer de session', async () => {
      accounts.findByEmail.mockResolvedValue(USER);
      accounts.getPasswordHash.mockResolvedValue(passwordHash);

      await expect(
        service.login({ email: USER.email, password: 'mauvais_mot_de_passe' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('refuse un e-mail inconnu avec la même erreur', async () => {
      accounts.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'inconnu@example.com', password: PASSWORD }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      expect(accounts.getPasswordHash).not.toHaveBeenCalled();
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('fait tourner les jetons en conservant la famille et la limite absolue', async () => {
      const { result, saved } = await loginAsUser();
      refreshTokens.findById.mockResolvedValue(saved);
      refreshTokens.revokeIfActive.mockResolvedValue({ count: 1 });
      accounts.findById.mockResolvedValue({
        id: USER.id,
        role: USER.role,
        agencyId: null,
      });

      const refreshed = await service.refresh(result.refreshToken);

      expect(refreshTokens.revokeIfActive).toHaveBeenCalledWith(saved.id);
      expect(refreshed.refreshToken).not.toBe(result.refreshToken);
      const [next] = refreshTokens.create.mock.calls[0] as [
        CreateRefreshTokenData,
      ];
      expect(next.id).not.toBe(saved.id);
      expect(next.familyId).toBe(saved.familyId);
      expect(next.sessionExpiresAt).toEqual(saved.sessionExpiresAt);
      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    });

    it('révoque toute la famille quand un jeton déjà utilisé est présenté', async () => {
      const { result, saved } = await loginAsUser();
      refreshTokens.findById.mockResolvedValue(saved);
      refreshTokens.revokeIfActive.mockResolvedValue({ count: 0 });
      accounts.findById.mockResolvedValue(USER);

      await expect(service.refresh(result.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(saved.familyId);
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('refuse un jeton dont la session a dépassé sa durée absolue', async () => {
      const { result, saved } = await loginAsUser();
      refreshTokens.findById.mockResolvedValue({
        ...saved,
        sessionExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh(result.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeIfActive).not.toHaveBeenCalled();
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('refuse un jeton enregistré pour un autre utilisateur', async () => {
      const { result, saved } = await loginAsUser();
      refreshTokens.findById.mockResolvedValue({
        ...saved,
        userId: '22222222-2222-4222-8222-222222222222',
      });

      await expect(service.refresh(result.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeIfActive).not.toHaveBeenCalled();
    });

    it('refuse un jeton qui ne correspond pas au hash enregistré', async () => {
      const { result, saved } = await loginAsUser();
      refreshTokens.findById.mockResolvedValue({
        ...saved,
        tokenHash: await argon2.hash('un-autre-jeton'),
      });

      await expect(service.refresh(result.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeIfActive).not.toHaveBeenCalled();
    });

    it('ferme la session quand le compte a été supprimé', async () => {
      const { result, saved } = await loginAsUser();
      refreshTokens.findById.mockResolvedValue(saved);
      accounts.findById.mockResolvedValue(null);

      await expect(service.refresh(result.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(saved.familyId);
    });

    it('refuse un jeton inconnu en base', async () => {
      const { result } = await loginAsUser();
      refreshTokens.findById.mockResolvedValue(null);

      await expect(service.refresh(result.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refuse un jeton mal signé sans interroger la base', async () => {
      const forged = await jwt.signAsync(
        { sub: USER.id },
        { secret: 'mauvais-secret', jwtid: 'jti', expiresIn: 60 },
      );

      await expect(service.refresh(forged)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.findById).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('révoque la famille de la session', async () => {
      const { result, saved } = await loginAsUser();

      await service.logout(result.accessToken);

      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(saved.familyId);
    });

    it('révoque aussi la session d’un jeton d’accès expiré', async () => {
      const expired = await jwt.signAsync(
        { sub: USER.id, role: USER.role, sid: 'famille-1', agencyId: null },
        { secret: CONFIG.JWT_ACCESS_SECRET, expiresIn: -10 },
      );

      await service.logout(expired);

      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('famille-1');
    });

    it('ignore silencieusement un jeton invalide', async () => {
      await expect(service.logout('pas-un-jwt')).resolves.toBeUndefined();
      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    });
  });

  describe('jeton invité', () => {
    it('émet un jeton invité vérifiable et renvoie son identifiant', async () => {
      const { guestToken, guestTokenExpiresAt } =
        await service.issueGuestToken();

      const guestId = await service.verifyGuestToken(guestToken);
      expect(guestId).toEqual(expect.any(String));
      expect(guestTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('renvoie null pour un jeton invité invalide', async () => {
      await expect(service.verifyGuestToken('pas-un-jwt')).resolves.toBeNull();
    });
  });

  describe('resolveIdentity', () => {
    it('reconnaît un utilisateur à partir d’un jeton d’accès valide', async () => {
      const accessToken = await jwt.signAsync(
        {
          sub: 'agent-1',
          role: Role.AGENT,
          sid: 'famille-1',
          agencyId: 'lyon',
        },
        { secret: CONFIG.JWT_ACCESS_SECRET, expiresIn: 60 },
      );

      await expect(
        service.resolveIdentity({ access_token: accessToken }),
      ).resolves.toEqual({
        kind: 'user',
        id: 'agent-1',
        role: Role.AGENT,
        agencyId: 'lyon',
      });
    });

    it('privilégie le jeton d’accès quand un jeton invité est aussi présent', async () => {
      const accessToken = await jwt.signAsync(
        { sub: USER.id, role: USER.role, sid: 'famille-1', agencyId: null },
        { secret: CONFIG.JWT_ACCESS_SECRET, expiresIn: 60 },
      );
      const { guestToken } = await service.issueGuestToken();

      await expect(
        service.resolveIdentity({
          access_token: accessToken,
          guest_token: guestToken,
        }),
      ).resolves.toMatchObject({ kind: 'user', id: USER.id });
    });

    it('rejette un jeton d’accès invalide (401)', async () => {
      await expect(
        service.resolveIdentity({ access_token: 'pas-un-jwt' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('reconnaît un invité à partir d’un jeton invité valide', async () => {
      const { guestToken } = await service.issueGuestToken();
      const guestId = await service.verifyGuestToken(guestToken);

      await expect(
        service.resolveIdentity({ guest_token: guestToken }),
      ).resolves.toEqual({ kind: 'guest', guestId });
    });

    it('rejette un jeton invité invalide (401)', async () => {
      await expect(
        service.resolveIdentity({ guest_token: 'pas-un-jwt' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('renvoie une identité anonyme sans cookie', async () => {
      await expect(service.resolveIdentity({})).resolves.toEqual({
        kind: 'anonymous',
      });
    });
  });
});
