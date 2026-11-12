import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../src/chat/chat.events';
import {
  AGENCY_IDS,
  createGuest,
  createTestApp,
  loginAgent,
  registerAndLoginCustomer,
  resetDatabase,
  type TestApp,
} from './setup/app';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type ServerEvent = keyof ServerToClientEvents;
type EventPayload<E extends ServerEvent> = Parameters<
  ServerToClientEvents[E]
>[0];

const LYON_NAME = 'Your Car Your Way – Lyon Part-Dieu';
const EVENT_TIMEOUT_MS = 2000;
const noop = () => undefined;

describe('Chat temps réel (e2e)', () => {
  let t: TestApp;
  let sockets: ClientSocket[];

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    sockets = [];
    await resetDatabase(t.prisma);
  });

  afterEach(() => {
    sockets.forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await t.app.close();
  });

  function connect(cookie?: string): Promise<ClientSocket> {
    const socket: ClientSocket = io(t.url, {
      transports: ['websocket'],
      extraHeaders: cookie ? { cookie } : {},
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  function nextEvent<E extends ServerEvent>(
    socket: ClientSocket,
    event: E,
  ): Promise<EventPayload<E>> {
    const listener = socket as unknown as {
      once(event: string, cb: (payload: EventPayload<E>) => void): void;
    };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Événement ${event} non reçu`)),
        EVENT_TIMEOUT_MS,
      );
      listener.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  /** Un invité ouvre une conversation avec l'agence de Lyon ; l'agent de Lyon est connecté. */
  async function lyonConversation() {
    const guestToken = await createGuest(t.server);
    const guestCookie = `guest_token=${guestToken}`;
    const created = await request(t.server)
      .post('/api/conversations')
      .set('Cookie', guestCookie)
      .send({ origin: 'AGENCY', agencyId: AGENCY_IDS.lyon })
      .expect(201);
    const { accessToken } = await loginAgent(t.server, 'lyon');

    return {
      conversationId: (created.body as { id: string }).id,
      guest: await connect(guestCookie),
      agent: await connect(`access_token=${accessToken}`),
    };
  }

  async function joinBoth() {
    const context = await lyonConversation();
    const { conversationId, guest, agent } = context;
    await agent.emitWithAck('conversation:join', { conversationId });
    await guest.emitWithAck('conversation:join', { conversationId });
    return context;
  }

  describe('connexion', () => {
    it('refuse une connexion sans cookie', async () => {
      await expect(connect()).rejects.toThrow('UNAUTHENTICATED');
    });

    it('refuse une connexion avec un jeton invalide', async () => {
      await expect(connect('access_token=pas-un-jwt')).rejects.toThrow(
        'UNAUTHENTICATED',
      );
    });
  });

  describe('conversation:join', () => {
    it('acquitte et prévient les participants déjà présents', async () => {
      const { conversationId, guest, agent } = await lyonConversation();
      await expect(
        agent.emitWithAck('conversation:join', { conversationId }),
      ).resolves.toEqual({ status: 'ok' });
      const joined = nextEvent(agent, 'conversation:participant-joined');

      await expect(
        guest.emitWithAck('conversation:join', { conversationId }),
      ).resolves.toEqual({ status: 'ok' });

      await expect(joined).resolves.toEqual({
        conversationId,
        participant: { type: 'GUEST', displayName: null },
        joinedAt: expect.any(String),
      });
    });

    it('présente un agent par le nom de son agence', async () => {
      const { conversationId, guest, agent } = await lyonConversation();
      await guest.emitWithAck('conversation:join', { conversationId });
      const joined = nextEvent(guest, 'conversation:participant-joined');

      await agent.emitWithAck('conversation:join', { conversationId });

      await expect(joined).resolves.toMatchObject({
        participant: { type: 'AGENT', displayName: LYON_NAME },
      });
    });

    it('présente un client par son prénom', async () => {
      const { accessToken } = await registerAndLoginCustomer(t.server);
      const customerCookie = `access_token=${accessToken}`;
      const created = await request(t.server)
        .post('/api/conversations')
        .set('Cookie', customerCookie)
        .send({ origin: 'AGENCY', agencyId: AGENCY_IDS.lyon })
        .expect(201);
      const conversationId = (created.body as { id: string }).id;
      const agent = await connect(
        `access_token=${(await loginAgent(t.server, 'lyon')).accessToken}`,
      );
      const customer = await connect(customerCookie);
      await agent.emitWithAck('conversation:join', { conversationId });
      const joined = nextEvent(agent, 'conversation:participant-joined');

      await customer.emitWithAck('conversation:join', { conversationId });

      await expect(joined).resolves.toMatchObject({
        participant: { type: 'CUSTOMER', displayName: 'Jean' },
      });
    });
  });

  describe('message:send', () => {
    it('enregistre le message et le diffuse aux deux participants', async () => {
      const { conversationId, guest, agent } = await joinBoth();
      const receivedByAgent = nextEvent(agent, 'message:new');
      const receivedByGuest = nextEvent(guest, 'message:new');

      const ack = await guest.emitWithAck('message:send', {
        conversationId,
        content: '  Bonjour, ma voiture ne démarre pas  ',
      });

      expect(ack).toEqual({ status: 'ok', id: expect.any(String) });
      const expected = {
        id: ack.id,
        conversationId,
        senderType: 'GUEST',
        senderUserId: null,
        senderAgencyId: null,
        content: 'Bonjour, ma voiture ne démarre pas',
        sentAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        senderAgency: null,
        senderUser: null,
      };
      await expect(receivedByAgent).resolves.toEqual(expected);
      await expect(receivedByGuest).resolves.toEqual(expected);
      await expect(
        t.prisma.message.count({ where: { conversationId } }),
      ).resolves.toBe(1);
    });

    it('joint le nom de l’agence aux messages d’un agent', async () => {
      const { conversationId, guest, agent } = await joinBoth();
      const received = nextEvent(guest, 'message:new');

      await agent.emitWithAck('message:send', {
        conversationId,
        content: 'Bonjour, je regarde votre dossier',
      });

      await expect(received).resolves.toMatchObject({
        senderType: 'AGENT',
        senderAgencyId: AGENCY_IDS.lyon,
        senderAgency: { name: LYON_NAME },
      });
    });
  });

  describe('conversation:close', () => {
    it('ferme la conversation et prévient les deux participants', async () => {
      const { conversationId, guest, agent } = await joinBoth();
      const closedForGuest = nextEvent(guest, 'conversation:closed');
      const closedForAgent = nextEvent(agent, 'conversation:closed');

      await expect(
        agent.emitWithAck('conversation:close', { conversationId }),
      ).resolves.toEqual({ status: 'ok' });

      const expected = {
        conversationId,
        closedAt: expect.any(String),
        closedBy: { type: 'AGENT', displayName: LYON_NAME },
      };
      await expect(closedForGuest).resolves.toEqual(expected);
      await expect(closedForAgent).resolves.toEqual(expected);
      const conversation = await t.prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
      });
      expect(conversation.status).toBe('CLOSED');
      expect(conversation.closedAt).not.toBeNull();
    });
  });

  describe('chat:error', () => {
    it('émet FORBIDDEN quand un agent d’une autre agence rejoint la conversation', async () => {
      const { conversationId } = await lyonConversation();
      const { accessToken } = await loginAgent(t.server, 'paris');
      const parisAgent = await connect(`access_token=${accessToken}`);
      const error = nextEvent(parisAgent, 'chat:error');

      parisAgent.emit('conversation:join', { conversationId }, noop);

      await expect(error).resolves.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('émet NOT_FOUND pour une conversation inconnue', async () => {
      const { agent } = await lyonConversation();
      const error = nextEvent(agent, 'chat:error');

      agent.emit(
        'conversation:join',
        { conversationId: '00000000-0000-4000-8000-000000000000' },
        noop,
      );

      await expect(error).resolves.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('émet VALIDATION_FAILED avec le détail pour un identifiant invalide', async () => {
      const { agent } = await lyonConversation();
      const error = nextEvent(agent, 'chat:error');

      agent.emit('conversation:join', { conversationId: 'pas-un-uuid' }, noop);

      await expect(error).resolves.toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [expect.objectContaining({ path: ['conversationId'] })],
      });
    });

    it('émet VALIDATION_FAILED pour un message vide', async () => {
      const { conversationId, guest } = await joinBoth();
      const error = nextEvent(guest, 'chat:error');

      guest.emit('message:send', { conversationId, content: '   ' }, noop);

      await expect(error).resolves.toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [expect.objectContaining({ path: ['content'] })],
      });
      await expect(t.prisma.message.count()).resolves.toBe(0);
    });

    it('émet CONVERSATION_CLOSED pour rejoindre une conversation fermée', async () => {
      const { conversationId, guest, agent } = await lyonConversation();
      await agent.emitWithAck('conversation:join', { conversationId });
      await agent.emitWithAck('conversation:close', { conversationId });
      const error = nextEvent(guest, 'chat:error');

      guest.emit('conversation:join', { conversationId }, noop);

      await expect(error).resolves.toMatchObject({
        code: 'CONVERSATION_CLOSED',
      });
    });

    it('émet CONVERSATION_CLOSED pour un message sur une conversation fermée', async () => {
      const { conversationId, guest, agent } = await joinBoth();
      await agent.emitWithAck('conversation:close', { conversationId });
      const error = nextEvent(guest, 'chat:error');

      guest.emit(
        'message:send',
        { conversationId, content: 'Encore là ?' },
        noop,
      );

      await expect(error).resolves.toMatchObject({
        code: 'CONVERSATION_CLOSED',
      });
      await expect(t.prisma.message.count()).resolves.toBe(0);
    });

    it('émet CONVERSATION_CLOSED pour fermer une conversation déjà fermée', async () => {
      const { conversationId, agent } = await lyonConversation();
      await agent.emitWithAck('conversation:join', { conversationId });
      await agent.emitWithAck('conversation:close', { conversationId });
      const error = nextEvent(agent, 'chat:error');

      agent.emit('conversation:close', { conversationId }, noop);

      await expect(error).resolves.toMatchObject({
        code: 'CONVERSATION_CLOSED',
      });
    });
  });
});
