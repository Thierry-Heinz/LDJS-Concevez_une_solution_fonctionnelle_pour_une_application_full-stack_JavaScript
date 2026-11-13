import { io, type Socket } from 'socket.io-client';
import { refreshSession } from '@/lib/api';
import type {
  ChatError,
  ClientToServerEvents,
  ErrorAck,
  OkAck,
  ServerToClientEvents,
} from '@/types/chat-events';

/**
 * Connexion Socket.IO unique pour toute l'application (singleton de module), ouverte à la demande.
 * Elle survit à la fermeture du popover : la conversation n'est pas perdue.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  withCredentials: true,
});

export function reconnectSocket() {
  const wasActive = socket.active;
  socket.disconnect();
  if (wasActive) socket.connect();
}

/**
 * Après une erreur `UNAUTHENTICATED` (access token expiré), la session est rafraîchie puis la connexion retentée une seule fois.
 * Le drapeau est réinitialisé à chaque connexion réussie.
 */
let retriedAfterRefresh = false;

socket.on('connect_error', (error) => {
  if (error.message !== 'UNAUTHENTICATED' || retriedAfterRefresh) {
    return;
  } else {
    retriedAfterRefresh = true;
    void refreshSession().then((ok) => {
      if (ok) socket.connect();
    });
  }
});

socket.on('connect', () => {
  retriedAfterRefresh = false;
});

export class ChatRequestError extends Error {
  code: string;
  details?: unknown;

  constructor(error: ChatError) {
    super(error.message);
    this.code = error.code;
    this.details = error.details;
  }
}

function unwrap<T extends { status: 'ok' }>(response: T | ErrorAck): T {
  if (response.status === 'error') {
    throw new ChatRequestError(response.error);
  } else {
    return response;
  }
}

const TIMEOUT_MS = 5000;
const timeoutError = new ChatRequestError({
  code: 'TIMEOUT',
  message: 'Le serveur ne répond pas.',
});

function toChatRequestError(error: unknown): never {
  if (error instanceof ChatRequestError) throw error;
  throw timeoutError;
}

/** Envoie un message ; résout `{ status: 'ok', id }` ou lève une `ChatRequestError` (refus du serveur ou délai dépassé). */
export async function sendMessage(payload: {
  conversationId: string;
  content: string;
}) {
  try {
    const response: OkAck | ErrorAck = await socket
      .timeout(TIMEOUT_MS)
      .emitWithAck('message:send', payload);
    return unwrap(response);
  } catch (error) {
    toChatRequestError(error);
  }
}

export async function joinConversation(conversationId: string) {
  try {
    const response: OkAck | ErrorAck = await socket
      .timeout(TIMEOUT_MS)
      .emitWithAck('conversation:join', { conversationId });
    return unwrap(response);
  } catch (error) {
    toChatRequestError(error);
  }
}

export async function closeConversation(conversationId: string) {
  try {
    const response: OkAck | ErrorAck = await socket
      .timeout(TIMEOUT_MS)
      .emitWithAck('conversation:close', { conversationId });
    return unwrap(response);
  } catch (error) {
    toChatRequestError(error);
  }
}
