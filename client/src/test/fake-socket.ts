import { vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

/**
 * Faux socket Socket.IO, piloté par les tests : `serverEmit` simule un événement envoyé par le serveur,
 * `connect`/`disconnect` déclenchent les mêmes événements que le vrai client.
 */
export class FakeSocket {
  connected = false;
  active = false;
  private handlers = new Map<string, Set<Handler>>();
  private managerHandlers = new Map<string, Set<Handler>>();

  on = vi.fn((event: string, handler: Handler) => {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  });

  off = vi.fn((event: string, handler: Handler) => {
    this.handlers.get(event)?.delete(handler);
    return this;
  });

  /** Comme le vrai client, la connexion aboutit de façon asynchrone : `connect` est émis à la microtâche suivante. */
  connect = vi.fn(() => {
    this.active = true;
    queueMicrotask(() => {
      if (!this.active || this.connected) return;
      this.connected = true;
      this.serverEmit('connect');
    });
    return this;
  });

  disconnect = vi.fn(() => {
    this.active = false;
    if (this.connected) {
      this.connected = false;
      this.serverEmit('disconnect');
    }
    return this;
  });

  /** Le Manager (`socket.io`) porte l'événement `reconnect`. */
  io = {
    on: (event: string, handler: Handler) => {
      if (!this.managerHandlers.has(event))
        this.managerHandlers.set(event, new Set());
      this.managerHandlers.get(event)!.add(handler);
    },
    off: (event: string, handler: Handler) => {
      this.managerHandlers.get(event)?.delete(handler);
    },
    emit: (event: string, ...args: unknown[]) => {
      this.managerHandlers.get(event)?.forEach((h) => h(...args));
    },
  };

  serverEmit(event: string, ...args: unknown[]) {
    [...(this.handlers.get(event) ?? [])].forEach((h) => h(...args));
  }

  listenerCount(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }

  reset() {
    this.connected = false;
    this.active = false;
    this.handlers.clear();
    this.managerHandlers.clear();
  }
}

export const fakeSocket = new FakeSocket();

/**
 * Remplaçant de `@/lib/socket` pour les tests de hooks, de composants et d'intégration :
 * `vi.mock('@/lib/socket', () => import('@/test/fake-socket').then((m) => m.socketModuleMock))`.
 * Les fonctions d'envoi réussissent par défaut ; un test peut les faire échouer avec `mockRejectedValueOnce`.
 */
export const socketModuleMock = {
  socket: fakeSocket,
  reconnectSocket: vi.fn(),
  joinConversation: vi.fn(async () => ({ status: 'ok' as const })),
  sendMessage: vi.fn(async () => ({ status: 'ok' as const, id: 'msg-x' })),
  closeConversation: vi.fn(async () => ({ status: 'ok' as const })),
  ChatRequestError: class ChatRequestError extends Error {},
};
