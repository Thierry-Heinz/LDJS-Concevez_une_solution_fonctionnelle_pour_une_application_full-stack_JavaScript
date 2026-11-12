/** COPIE de chat.events.ts de /server */

// Contrat des événements Socket.IO du chat.
// Ce fichier ne dépend ni de Nest ni de Prisma : il pourra être copié tel quel côté front.

// ─── Données partagées ───────────────────────────────────────────

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
  sentAt: string; // date ISO (voir la remarque plus bas)
  senderAgency: { name: string } | null;
  senderUser: { customer: { firstName: string } | null } | null;
};

export type ChatError = {
  code: string;
  message: string;
  details?: unknown;
  event?: string; // événement fautif, renseigné seulement dans chat:error
};

// ─── Réponses des acks ───────────────────────────────────────────

// En cas d'échec, l'ack reçoit ErrorAck. Si le client n'a pas fourni d'ack,
// l'erreur arrive à la place dans l'événement chat:error.
export type OkAck = { status: 'ok' };
export type MessageSentAck = { status: 'ok'; id: string };
export type ErrorAck = { status: 'error'; error: ChatError };

// ─── Client → serveur ────────────────────────────────────────────

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

// ─── Serveur → client ────────────────────────────────────────────

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

// Pas de communication entre plusieurs serveurs dans le PoC
export type InterServerEvents = Record<string, never>;
