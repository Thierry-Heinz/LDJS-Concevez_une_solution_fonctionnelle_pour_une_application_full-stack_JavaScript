import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Le vrai client Socket.IO est remplacé : on teste la logique de `lib/socket.ts`, pas la bibliothèque. */
const { fake, emitWithAck, refreshSession } = vi.hoisted(() => {
  const handlers = new Map<string, (arg: unknown) => void>();
  const emitWithAck = vi.fn();
  const fake = {
    active: false,
    handlers,
    on: vi.fn((event: string, handler: (arg: unknown) => void) => {
      handlers.set(event, handler);
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    timeout: vi.fn(() => ({ emitWithAck })),
  };
  return { fake, emitWithAck, refreshSession: vi.fn() };
});

vi.mock('socket.io-client', () => ({ io: vi.fn(() => fake) }));
vi.mock('@/lib/api', () => ({ refreshSession }));

const {
  ChatRequestError,
  closeConversation,
  joinConversation,
  reconnectSocket,
  sendMessage,
} = await import('@/lib/socket');
const { io } = await import('socket.io-client');
/** Relevé avant que `clearAllMocks` n'efface les appels faits au chargement du module. */
const ioOptions = vi.mocked(io).mock.calls[0]?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  fake.active = false;
});

describe('création du socket', () => {
  it("n'ouvre pas la connexion au chargement et envoie les cookies", () => {
    expect(ioOptions).toEqual({ autoConnect: false, withCredentials: true });
  });
});

describe('reconnectSocket', () => {
  it('se reconnecte si la connexion était active, pour prendre en compte les nouveaux cookies', () => {
    fake.active = true;
    reconnectSocket();
    expect(fake.disconnect).toHaveBeenCalled();
    expect(fake.connect).toHaveBeenCalled();
  });

  it('ne se connecte pas si le socket était inactif', () => {
    reconnectSocket();
    expect(fake.disconnect).toHaveBeenCalled();
    expect(fake.connect).not.toHaveBeenCalled();
  });
});

describe('connect_error', () => {
  const connectError = (message: string) =>
    fake.handlers.get('connect_error')!(new Error(message));

  it('rafraîchit la session puis retente une seule fois après UNAUTHENTICATED', async () => {
    refreshSession.mockResolvedValue(true);

    connectError('UNAUTHENTICATED');
    await vi.waitFor(() => expect(fake.connect).toHaveBeenCalledTimes(1));

    connectError('UNAUTHENTICATED');
    await Promise.resolve();
    expect(refreshSession).toHaveBeenCalledTimes(1);

    // Une connexion réussie réarme le mécanisme.
    fake.handlers.get('connect')!(undefined);
    connectError('UNAUTHENTICATED');
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  it('ignore les autres erreurs de connexion', () => {
    connectError('xhr poll error');
    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe.each([
  [
    'sendMessage',
    () => sendMessage({ conversationId: 'c1', content: 'Bonjour' }),
    'message:send',
    { conversationId: 'c1', content: 'Bonjour' },
  ],
  [
    'joinConversation',
    () => joinConversation('c1'),
    'conversation:join',
    { conversationId: 'c1' },
  ],
  [
    'closeConversation',
    () => closeConversation('c1'),
    'conversation:close',
    { conversationId: 'c1' },
  ],
] as const)('%s', (_name, call, event, payload) => {
  it("émet l'événement avec un délai maximal et renvoie l'accusé de réception", async () => {
    emitWithAck.mockResolvedValue({ status: 'ok' });

    await expect(call()).resolves.toEqual({ status: 'ok' });
    expect(fake.timeout).toHaveBeenCalledWith(5000);
    expect(emitWithAck).toHaveBeenCalledWith(event, payload);
  });

  it('lève une ChatRequestError avec le code renvoyé par le serveur', async () => {
    emitWithAck.mockResolvedValue({
      status: 'error',
      error: { code: 'CONVERSATION_CLOSED', message: 'Conversation fermée' },
    });

    const error = await call().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChatRequestError);
    expect(error).toMatchObject({
      code: 'CONVERSATION_CLOSED',
      message: 'Conversation fermée',
    });
  });

  it('lève une erreur TIMEOUT si le serveur ne répond pas', async () => {
    emitWithAck.mockRejectedValue(new Error('operation has timed out'));

    await expect(call()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
