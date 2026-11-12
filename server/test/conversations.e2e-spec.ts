import request from 'supertest';
import {
  AGENCY_IDS,
  createGuest,
  createTestApp,
  loginAgent,
  registerAndLoginCustomer,
  resetDatabase,
  type TestApp,
} from './setup/app';

type ConversationBody = { id: string; agencyId: string; status: string };

describe('Conversations (e2e)', () => {
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

  async function guestCookie() {
    return `guest_token=${await createGuest(t.server)}`;
  }

  async function customerCookie() {
    const { accessToken } = await registerAndLoginCustomer(t.server);
    return `access_token=${accessToken}`;
  }

  async function agentCookie(agent: 'lyon' | 'paris' | 'central') {
    const { accessToken } = await loginAgent(t.server, agent);
    return `access_token=${accessToken}`;
  }

  function start(cookie: string | undefined, body: object) {
    const req = request(t.server).post('/api/conversations');
    if (cookie) {
      req.set('Cookie', cookie);
    }
    return req.send(body);
  }

  describe('POST /api/conversations', () => {
    it('crée une conversation GENERAL rattachée à l’agence centrale', async () => {
      const response = await start(await guestCookie(), {
        origin: 'GENERAL',
      }).expect(201);

      expect(response.body).toMatchObject({
        origin: 'GENERAL',
        agencyId: AGENCY_IDS.central,
        status: 'OPEN',
        customerId: null,
        guestId: expect.any(String),
      });
    });

    it('crée une conversation AGENCY rattachée à l’agence choisie', async () => {
      const response = await start(await customerCookie(), {
        origin: 'AGENCY',
        agencyId: AGENCY_IDS.lyon,
      }).expect(201);

      expect(response.body).toMatchObject({
        origin: 'AGENCY',
        agencyId: AGENCY_IDS.lyon,
        customerId: expect.any(String),
        guestId: null,
      });
    });

    it('renvoie la conversation déjà ouverte au lieu d’en créer une seconde', async () => {
      const cookie = await guestCookie();
      const first = await start(cookie, { origin: 'GENERAL' }).expect(201);

      const second = await start(cookie, {
        origin: 'AGENCY',
        agencyId: AGENCY_IDS.lyon,
      }).expect(201);

      expect((second.body as ConversationBody).id).toBe(
        (first.body as ConversationBody).id,
      );
      expect(await t.prisma.conversation.count()).toBe(1);
    });

    it('refuse une requête sans identité (401)', async () => {
      await start(undefined, { origin: 'GENERAL' }).expect(401);
    });

    it('refuse un agent (403)', async () => {
      await start(await agentCookie('lyon'), { origin: 'GENERAL' }).expect(403);
    });

    it.each([
      ['une origine AGENCY sans agencyId', { origin: 'AGENCY' }],
      ['une origine inconnue', { origin: 'BOOKING' }],
      [
        'un agencyId qui n’est pas un UUID',
        { origin: 'AGENCY', agencyId: 'lyon' },
      ],
      ['un corps vide', {}],
    ])('refuse %s (400)', async (_label, body) => {
      const response = await start(await guestCookie(), body).expect(400);

      expect(response.body).toMatchObject({ message: 'Validation failed' });
    });

    it('refuse l’agence centrale pour une demande AGENCY (404)', async () => {
      await start(await guestCookie(), {
        origin: 'AGENCY',
        agencyId: AGENCY_IDS.central,
      }).expect(404);
    });
  });

  describe('GET /api/conversations/current', () => {
    it('renvoie la conversation ouverte de l’invité', async () => {
      const cookie = await guestCookie();
      const created = await start(cookie, { origin: 'GENERAL' }).expect(201);

      const response = await request(t.server)
        .get('/api/conversations/current')
        .set('Cookie', cookie)
        .expect(200);

      expect((response.body as ConversationBody).id).toBe(
        (created.body as ConversationBody).id,
      );
    });

    it('renvoie 404 quand aucune conversation n’est ouverte', async () => {
      await request(t.server)
        .get('/api/conversations/current')
        .set('Cookie', await customerCookie())
        .expect(404);
    });

    it('refuse une requête sans identité (401)', async () => {
      await request(t.server).get('/api/conversations/current').expect(401);
    });

    it('refuse un jeton d’accès invalide (401)', async () => {
      await request(t.server)
        .get('/api/conversations/current')
        .set('Cookie', 'access_token=pas-un-jwt')
        .expect(401);
    });
  });

  describe('GET /api/conversations/open', () => {
    it('liste les conversations ouvertes de l’agence de l’agent uniquement', async () => {
      const lyon = await start(await guestCookie(), {
        origin: 'AGENCY',
        agencyId: AGENCY_IDS.lyon,
      }).expect(201);
      await start(await guestCookie(), {
        origin: 'AGENCY',
        agencyId: AGENCY_IDS.paris,
      }).expect(201);

      const response = await request(t.server)
        .get('/api/conversations/open')
        .set('Cookie', await agentCookie('lyon'))
        .expect(200);

      const ids = (response.body as ConversationBody[]).map((c) => c.id);
      expect(ids).toEqual([(lyon.body as ConversationBody).id]);
    });

    it('refuse un client (403)', async () => {
      await request(t.server)
        .get('/api/conversations/open')
        .set('Cookie', await customerCookie())
        .expect(403);
    });

    it('refuse une requête sans identité (403)', async () => {
      await request(t.server).get('/api/conversations/open').expect(403);
    });
  });

  describe('GET /api/conversations/:id/messages', () => {
    async function lyonConversation() {
      const cookie = await guestCookie();
      const response = await start(cookie, {
        origin: 'AGENCY',
        agencyId: AGENCY_IDS.lyon,
      }).expect(201);
      return { cookie, id: (response.body as ConversationBody).id };
    }

    it('renvoie l’historique au propriétaire et à l’agence concernée', async () => {
      const { cookie, id } = await lyonConversation();

      await request(t.server)
        .get(`/api/conversations/${id}/messages`)
        .set('Cookie', cookie)
        .expect(200, []);
      await request(t.server)
        .get(`/api/conversations/${id}/messages`)
        .set('Cookie', await agentCookie('lyon'))
        .expect(200, []);
    });

    it('refuse un agent d’une autre agence (403)', async () => {
      const { id } = await lyonConversation();

      await request(t.server)
        .get(`/api/conversations/${id}/messages`)
        .set('Cookie', await agentCookie('paris'))
        .expect(403);
    });

    it('refuse un autre invité (403)', async () => {
      const { id } = await lyonConversation();

      await request(t.server)
        .get(`/api/conversations/${id}/messages`)
        .set('Cookie', await guestCookie())
        .expect(403);
    });

    it('renvoie 404 pour une conversation inconnue', async () => {
      await request(t.server)
        .get('/api/conversations/00000000-0000-4000-8000-000000000000/messages')
        .set('Cookie', await agentCookie('lyon'))
        .expect(404);
    });

    it('refuse un identifiant qui n’est pas un UUID (400)', async () => {
      await request(t.server)
        .get('/api/conversations/pas-un-uuid/messages')
        .set('Cookie', await agentCookie('lyon'))
        .expect(400);
    });
  });
});
