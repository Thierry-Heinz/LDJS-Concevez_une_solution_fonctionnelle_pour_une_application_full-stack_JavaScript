import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY, Public } from '../decorators/public.decorators';
import { Role } from '../../generated/prisma/enums';

const ACCESS_SECRET = 'secret-acces-de-test';

class FakeController {
  @Public()
  publicRoute(this: void) {}

  protectedRoute(this: void) {}
}

function createContext(
  handler: () => void,
  request: Record<string, unknown>,
  type = 'http',
) {
  return {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => FakeController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({});
  const config = {
    getOrThrow: () => ACCESS_SECRET,
  } as unknown as ConfigService;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard(new Reflector(), jwt, config);
  });

  it('laisse passer une route marquée @Public sans cookie', async () => {
    const controller = new FakeController();

    await expect(
      guard.canActivate(createContext(controller.publicRoute, {})),
    ).resolves.toBe(true);
  });

  it('lit la métadonnée @Public sur la méthode puis sur le contrôleur', () => {
    const reflector = new Reflector();
    const spy = jest.spyOn(reflector, 'getAllAndOverride');
    guard = new JwtAuthGuard(reflector, jwt, config);
    const controller = new FakeController();

    void guard.canActivate(createContext(controller.publicRoute, {}));

    expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      controller.publicRoute,
      FakeController,
    ]);
  });

  it('ne s’applique pas aux contextes autres que HTTP', async () => {
    const controller = new FakeController();

    await expect(
      guard.canActivate(createContext(controller.protectedRoute, {}, 'ws')),
    ).resolves.toBe(true);
  });

  it('refuse une route protégée sans cookie access_token (401)', async () => {
    const controller = new FakeController();

    await expect(
      guard.canActivate(
        createContext(controller.protectedRoute, { cookies: {} }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un jeton signé avec un autre secret (401)', async () => {
    const controller = new FakeController();
    const token = await jwt.signAsync(
      { sub: 'user-1', role: Role.CUSTOMER, sid: 'famille-1' },
      { secret: 'mauvais-secret', expiresIn: 60 },
    );

    await expect(
      guard.canActivate(
        createContext(controller.protectedRoute, {
          cookies: { access_token: token },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un jeton expiré (401)', async () => {
    const controller = new FakeController();
    const token = await jwt.signAsync(
      { sub: 'user-1', role: Role.CUSTOMER, sid: 'famille-1' },
      { secret: ACCESS_SECRET, expiresIn: -10 },
    );

    await expect(
      guard.canActivate(
        createContext(controller.protectedRoute, {
          cookies: { access_token: token },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepte un jeton valide et renseigne request.user', async () => {
    const controller = new FakeController();
    const token = await jwt.signAsync(
      { sub: 'agent-1', role: Role.AGENT, sid: 'famille-1', agencyId: 'lyon' },
      { secret: ACCESS_SECRET, expiresIn: 60 },
    );
    const request: Record<string, unknown> = {
      cookies: { access_token: token },
    };

    await expect(
      guard.canActivate(createContext(controller.protectedRoute, request)),
    ).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'agent-1',
      role: Role.AGENT,
      sid: 'famille-1',
      agencyId: 'lyon',
    });
  });

  it('renseigne agencyId à null quand le jeton n’en contient pas', async () => {
    const controller = new FakeController();
    const token = await jwt.signAsync(
      { sub: 'user-1', role: Role.CUSTOMER, sid: 'famille-1' },
      { secret: ACCESS_SECRET, expiresIn: 60 },
    );
    const request: Record<string, unknown> = {
      cookies: { access_token: token },
    };

    await guard.canActivate(createContext(controller.protectedRoute, request));

    expect(request.user).toMatchObject({ id: 'user-1', agencyId: null });
  });
});
