import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { RegisterDto } from './dto/register.dto';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import {
  AccessTokenPayload,
  Identity,
  RefreshTokenPayload,
} from './auth.types';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;
  private readonly accessSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshSecret: string;
  private readonly guestSecret: string;
  private readonly refreshIdleTtlSeconds: number;
  private readonly sessionAbsoluteTtlSeconds: number;
  private readonly guestTtlSeconds: number;

  constructor(
    private readonly accountsService: AccountsService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessTtlSeconds = Number(
      config.getOrThrow<string>('ACCESS_TOKEN_TTL_SECONDS'),
    );
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.guestSecret = config.getOrThrow<string>('JWT_GUEST_SECRET');
    this.refreshIdleTtlSeconds = Number(
      config.getOrThrow<string>('REFRESH_TOKEN_IDLE_TTL_SECONDS'),
    );
    this.sessionAbsoluteTtlSeconds = Number(
      config.getOrThrow<string>('SESSION_ABSOLUTE_TTL_SECONDS'),
    );
    this.guestTtlSeconds = Number(
      config.getOrThrow<string>('GUEST_TOKEN_TTL_SECONDS'),
    );
  }

  async onModuleInit() {
    this.dummyHash = await argon2.hash('dummy-password-for-timing');
  }

  /**
   * Crée un compte client. L'e-mail est normalisé (espaces retirés, minuscules)
   * et le mot de passe haché avec argon2.
   *
   * @throws ConflictException `EMAIL_ALREADY_USED` si l'e-mail a déjà un compte.
   */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password);
    try {
      await this.accountsService.createCustomer({
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate,
        address: dto.address,
      });
    } catch (error) {
      // P2002 : contrainte d'unicité violée, ici sur users.email. On s'appuie sur
      // la base plutôt que sur une lecture préalable, qui laisserait passer deux
      // inscriptions simultanées.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_USED',
          message: 'Adresse e-mail déjà utilisée',
        });
      }
      throw error;
    }
  }

  /**
   * Vérifie les identifiants et ouvre une nouvelle session : une nouvelle
   * famille de jetons, avec une limite de durée absolue.
   *
   * @returns l'utilisateur et ses jetons, que le contrôleur dépose en cookies.
   * @throws UnauthorizedException si l'e-mail ou le mot de passe est faux
   * (même erreur dans les deux cas).
   */
  async login(dto: LoginDto) {
    const user = await this.validateCredentials(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const familyId = crypto.randomUUID();
    const sessionExpiresAt = new Date(
      Date.now() + this.sessionAbsoluteTtlSeconds * 1000,
    );
    const tokens = await this.issueTokens(user, { familyId, sessionExpiresAt });
    return { user, ...tokens };
  }

  /**
   * Révoque tous les jetons de rafraîchissement de la session. Accepte un
   * jeton d'accès expiré (la signature reste vérifiée), car on doit pouvoir se
   * déconnecter après 15 min. Ne fait rien, sans erreur, si le jeton est invalide.
   */
  async logout(accessToken: string) {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        accessToken,
        {
          secret: this.accessSecret,
          ignoreExpiration: true, // jeton expiré accepté, signature toujours vérifiée
        },
      );
    } catch {
      return;
    }
    if (!payload.sid) {
      return;
    }
    await this.refreshTokensRepository.revokeFamily(payload.sid);
  }

  /**
   * Échange un jeton de rafraîchissement contre une nouvelle paire de jetons
   * (rotation). Le jeton présenté est révoqué ; la session garde sa famille et sa
   * limite absolue. Si un jeton déjà utilisé est présenté (signe de vol), toute la
   * famille est révoquée.
   *
   * @throws UnauthorizedException si le jeton est invalide, inconnu ou réutilisé,
   * si la session a expiré ou si le compte n'existe plus.
   */
  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);

    const saved = await this.refreshTokensRepository.findById(payload.jti);
    if (!saved || saved.userId !== payload.sub) {
      throw new UnauthorizedException();
    }

    // Limite absolue de la session
    if (saved.sessionExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }

    // Le jeton présenté est bien celui enregistré
    const valid = await argon2.verify(saved.tokenHash, refreshToken);
    if (!valid) {
      throw new UnauthorizedException();
    }

    // Le compte existe toujours (et on récupère son rôle)
    const user = await this.accountsService.findById(saved.userId);
    if (!user) {
      await this.closeSession(saved.familyId);
      throw new UnauthorizedException();
    }

    const { count } = await this.refreshTokensRepository.revokeIfActive(
      saved.id,
    );
    if (count === 0) {
      await this.closeSession(saved.familyId);
      throw new UnauthorizedException();
    }

    const tokens = await this.issueTokens(user, {
      familyId: saved.familyId, // la session continue
      sessionExpiresAt: saved.sessionExpiresAt, // avec la même limite absolue
    });

    return { user, ...tokens };
  }

  /**
   * Crée un jeton invité signé, porteur d'un identifiant aléatoire.
   * Il permet d'utiliser le chat sans compte.
   */
  async issueGuestToken() {
    const now = Date.now();

    const guestTokenExpiresAt = new Date(now + this.guestTtlSeconds * 1000);

    const guestId = crypto.randomUUID();
    const guestToken = await this.jwtService.signAsync(
      {
        sub: guestId,
      },
      {
        secret: this.guestSecret,
        expiresIn: this.guestTtlSeconds,
      },
    );

    return { guestToken, guestTokenExpiresAt };
  }

  /**
   * @returns l'identifiant invité porté par le jeton, ou `null` si le jeton
   * est invalide ou expiré.
   */
  async verifyGuestToken(token: string): Promise<string | null> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        {
          secret: this.guestSecret,
        },
      );
      return payload.sub;
    } catch {
      return null;
    }
  }

  /**
   * Déduit l'identité de l'appelant depuis ses cookies : utilisateur
   * (`access_token`), invité (`guest_token`) ou anonyme (aucun des deux).
   * Le jeton d'accès est prioritaire.
   *
   * @throws UnauthorizedException si le cookie présent est invalide ; on ne
   * retombe pas sur l'autre cookie.
   */
  async resolveIdentity(cookies: Record<string, unknown>): Promise<Identity> {
    const accessToken = cookies?.access_token;
    if (typeof accessToken === 'string') {
      try {
        const accessPayload =
          await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken, {
            secret: this.accessSecret,
          });
        return {
          kind: 'user',
          id: accessPayload.sub,
          role: accessPayload.role,
          agencyId: accessPayload.agencyId ?? null,
        };
      } catch {
        throw new UnauthorizedException();
      }
    }

    const guestToken = cookies?.guest_token;
    if (typeof guestToken === 'string') {
      const guestId = await this.verifyGuestToken(guestToken);
      if (!guestId) {
        throw new UnauthorizedException();
      }
      return {
        kind: 'guest',
        guestId: guestId,
      };
    }

    return {
      kind: 'anonymous',
    };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException();
    }
  }

  private async closeSession(familyId: string) {
    await this.refreshTokensRepository.revokeFamily(familyId);
  }

  /**
   * @returns l'utilisateur si l'e-mail et le mot de passe sont bons, sinon
   * `null`. Pour un e-mail inconnu, un hash factice est quand même vérifié : la
   * réponse prend le même temps, ce qui empêche de deviner les e-mails inscrits.
   */
  private async validateCredentials(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.accountsService.findByEmail(normalizedEmail);
    if (!user) {
      await argon2.verify(this.dummyHash, password);
      return null;
    }
    const passwordHash = await this.accountsService.getPasswordHash(user.id);
    if (!passwordHash) {
      return null;
    }
    const valid = await argon2.verify(passwordHash, password);
    if (!valid) {
      return null;
    }
    return user;
  }

  /**
   * Signe un jeton d'accès et un jeton de rafraîchissement, et enregistre le
   * hash du second en base. Le jeton de rafraîchissement expire au plus tôt entre
   * la fin d'inactivité et la limite absolue de la session.
   */
  private async issueTokens(
    user: { id: string; role: Role; agencyId: string | null },
    session: { familyId: string; sessionExpiresAt: Date },
  ) {
    const now = Date.now();

    const accessExpiresAt = new Date(now + this.accessTtlSeconds * 1000);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        role: user.role,
        sid: session.familyId,
        agencyId: user.agencyId,
      },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
      },
    );

    const jti = crypto.randomUUID();

    const refreshExpiresAt = new Date(
      Math.min(
        now + this.refreshIdleTtlSeconds * 1000,
        session.sessionExpiresAt.getTime(),
      ),
    );

    const refreshTtlSeconds = Math.floor(
      (refreshExpiresAt.getTime() - now) / 1000,
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
      },
      {
        secret: this.refreshSecret,
        expiresIn: refreshTtlSeconds,
        jwtid: jti,
      },
    );

    const tokenHash = await argon2.hash(refreshToken);

    await this.refreshTokensRepository.create({
      id: jti,
      userId: user.id,
      familyId: session.familyId,
      tokenHash,
      expiresAt: refreshExpiresAt,
      sessionExpiresAt: session.sessionExpiresAt,
    });

    return { accessToken, accessExpiresAt, refreshToken, refreshExpiresAt };
  }
}
