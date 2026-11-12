import type { Server, Socket } from 'socket.io';
import type { Identity } from '../auth/auth.types';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
} from './chat.events';

export type SocketData = { identity: Identity };

export type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
export type ChatServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
