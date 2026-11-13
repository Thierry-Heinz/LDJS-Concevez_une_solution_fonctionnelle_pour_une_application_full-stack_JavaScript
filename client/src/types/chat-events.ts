/** @file Copie de `server/src/chat/chat.events.ts` : ne pas modifier ici, modifier l'original puis le recopier. */

export type SenderType = 'GUEST' | 'CUSTOMER' | 'AGENT';

export type Participant = {
  type: SenderType;
  displayName: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderUserId: string | null;
  senderAgencyId: string | null;
  content: string;
  /** Date ISO. */
  sentAt: string;
  senderAgency: { name: string } | null;
  senderUser: { customer: { firstName: string } | null } | null;
};

export type ChatError = {
  code: string;
  message: string;
  details?: unknown;
  /** Événement fautif, renseigné uniquement dans `chat:error`. */
  event?: string;
};

export type OkAck = { status: 'ok' };
export type MessageSentAck = { status: 'ok'; id: string };
/** Reçu par l'ack en cas d'échec ; si le client n'a pas fourni d'ack, l'erreur arrive dans l'événement `chat:error`. */
export type ErrorAck = { status: 'error'; error: ChatError };

export interface ClientToServerEvents {
  'conversation:join': (
    payload: { conversationId: string },
    ack: (res: OkAck | ErrorAck) => void,
  ) => void;

  'message:send': (
    payload: { conversationId: string; content: string },
    ack: (res: MessageSentAck | ErrorAck) => void,
  ) => void;

  'conversation:close': (
    payload: { conversationId: string },
    ack: (res: OkAck | ErrorAck) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'conversation:participant-joined': (payload: {
    conversationId: string;
    participant: Participant;
    joinedAt: string;
  }) => void;

  'message:new': (message: ChatMessage) => void;

  'conversation:closed': (payload: {
    conversationId: string;
    closedAt: string;
    closedBy: Participant;
  }) => void;

  'chat:error': (error: ChatError) => void;
}

/** Aucune communication entre serveurs dans le PoC. */
export type InterServerEvents = Record<string, never>;
