import request from 'supertest';
import {
  AGENCY_IDS,
  AGENTS,
  CUSTOMER,
  createTestApp,
  getCookie,
  getSetCookie,
  loginAgent,
  registerAndLoginCustomer,
  resetDatabase,
  type TestApp,
} from './setup/app';

describe('Authentification (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  function refresh(refreshToken: string) {
    return request(t.server)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`);
  }

  describe('inscription et connexion', () => {
    it('inscrit un client puis le connecte avec des cookies HttpOnly', async () => {
      const { response } = await registerAndLoginCustomer(t.server);

      expect(response.body).toMatchObject({
        email: CUSTOMER.email,
        role: 'CUSTOMER',
        agencyId: null,
      });
      expect(getSetCookie(response, 'access_token')).toMatch(/HttpOnly/);
      expect(getSetCookie(response, 'refresh_token')).toMatch(
        /Path=\/api\/auth\/refresh.*HttpOnly/,
      );
    });

    it('enregistre l’e-mail en minuscules et ne stocke jamais le mot de passe en clair', async () => {
      await request(t.server)
        .post('/api/auth/register')
        .send({ ...CUSTOMER, email: 'Jean.Dupont@Example.com' })
        .expect(201);

      const user = await t.prisma.user.findUniqueOrThrow({
        where: { email: CUSTOMER.email },
        include: { customer: true },
      });
      expect(user.passwordHash).toMatch(/^\$argon2/);
      expect(user.customer?.birthDate.toISOString()).toBe(
        '1990-05-12T00:00:00.000Z',
      );
    });

    it('refuse une inscription invalide (400)', async () => {
      const response = await request(t.server)
        .post('/api/auth/register')
        .send({ ...CUSTOMER, email: 'pas-un-email', password: 'court' })
        .expect(400);

      expect(response.body).toMatchObject({ message: 'Validation failed' });
    });

    it('refuse un mauvais mot de passe (401)', async () => {
      await registerAndLoginCustomer(t.server);

      await request(t.server)
        .post('/api/auth/login')
        .send({ email: CUSTOMER.email, password: 'mauvais_mot_de_passe' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('renvoie le profil du client connecté', async () => {
      const { accessToken } = await registerAndLoginCustomer(t.server);

      const response = await request(t.server)
        .get('/api/auth/me')
        .set('Cookie', `access_token=${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        email: CUSTOMER.email,
        role: 'CUSTOMER',
        firstName: CUSTOMER.firstName,
        lastName: CUSTOMER.lastName,
      });
    });

    it('renvoie le profil d’un agent sans nom ni prénom', async () => {
      const { accessToken } = await loginAgent(t.server, 'lyon');

      const response = await request(t.server)
        .get('/api/auth/me')
        .set('Cookie', `access_token=${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        email: AGENTS.lyon,
        role: 'AGENT',
        firstName: null,
      });
    });

    it('refuse une requête sans cookie (401)', async () => {
      await request(t.server).get('/api/auth/me').expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('fait tourner les jetons et renvoie l’utilisateur', async () => {
      const { refreshToken } = await registerAndLoginCustomer(t.server);

      const response = await refresh(refreshToken).expect(200);

      expect(response.body).toMatchObject({ role: 'CUSTOMER' });
      const nextRefresh = getCookie(response, 'refresh_token');
      expect(nextRefresh).toBeDefined();
      expect(nextRefresh).not.toBe(refreshToken);
      await request(t.server)
        .get('/api/auth/me')
        .set('Cookie', `access_token=${getCookie(response, 'access_token')}`)
        .expect(200);
    });

    it('refuse un jeton déjà utilisé et révoque toute la session', async () => {
      const { refreshToken } = await registerAndLoginCustomer(t.server);
      const rotated = await refresh(refreshToken).expect(200);
      const nextRefresh = getCookie(rotated, 'refresh_token')!;

      const reused = await refresh(refreshToken).expect(401);

      expect(getSetCookie(reused, 'refresh_token')).toMatch(
        /refresh_token=;.*Expires=Thu, 01 Jan 1970/,
      );
      await refresh(nextRefresh).expect(401);
      const active = await t.prisma.refreshToken.count({
        where: { revokedAt: null },
      });
      expect(active).toBe(0);
    });

    it('refuse une requête sans jeton de rafraîchissement (401)', async () => {
      await request(t.server).post('/api/auth/refresh').expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('révoque la session et efface les cookies', async () => {
      const { accessToken, refreshToken } = await registerAndLoginCustomer(
        t.server,
      );

      const response = await request(t.server)
        .post('/api/auth/logout')
        .set('Cookie', `access_token=${accessToken}`)
        .expect(204);

      expect(getSetCookie(response, 'access_token')).toMatch(
        /access_token=;.*Expires=Thu, 01 Jan 1970/,
      );
      await refresh(refreshToken).expect(401);
    });

    it('répond 204 même sans session', async () => {
      await request(t.server).post('/api/auth/logout').expect(204);
    });
  });

  describe('POST /api/auth/guest', () => {
    it('dépose un cookie guest_token HttpOnly', async () => {
      const response = await request(t.server)
        .post('/api/auth/guest')
        .expect(204);

      expect(getSetCookie(response, 'guest_token')).toMatch(/HttpOnly/);
    });

    it('conserve un jeton invité encore valide', async () => {
      const first = await request(t.server).post('/api/auth/guest').expect(204);
      const guestToken = getCookie(first, 'guest_token')!;

      const second = await request(t.server)
        .post('/api/auth/guest')
        .set('Cookie', `guest_token=${guestToken}`)
        .expect(204);

      expect(getSetCookie(second, 'guest_token')).toBeUndefined();
    });

    it('remplace un jeton invité invalide', async () => {
      const response = await request(t.server)
        .post('/api/auth/guest')
        .set('Cookie', 'guest_token=pas-un-jwt')
        .expect(204);

      expect(getCookie(response, 'guest_token')).not.toBe('pas-un-jwt');
    });
  });

  it('liste les agences sans authentification', async () => {
    const response = await request(t.server).get('/api/agencies').expect(200);

    expect(response.body).toHaveLength(4);
    expect(response.body).toContainEqual({
      id: AGENCY_IDS.lyon,
      name: 'Your Car Your Way – Lyon Part-Dieu',
    });
  });
});
