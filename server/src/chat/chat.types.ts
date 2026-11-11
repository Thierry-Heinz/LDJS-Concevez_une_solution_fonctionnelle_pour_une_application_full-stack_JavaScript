import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import type { Identity } from '../auth/auth.types';

// Forme des données envoyées par le client
export interface SendMessagePayload {
  content: string;
}

// Forme du message diffusé par le serveur
export interface ChatMessage {
  id: string;
  authorId: string;
  content: string;
  sentAt: string; // ISO 8601, en UTC
}

export interface JoinConversationPayload {
  conversationId: string;
}

export type SocketData = { identity: Identity };

export type ChatSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
export type ChatServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
