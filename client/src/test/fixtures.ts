/** @file Données de test typées d'après les schémas de l'API. */
import type {
  Agency,
  Conversation,
  SessionUser,
  UserProfile,
} from '@/types/api';
import type { ChatMessage } from '@/types/chat-events';

export const agency: Agency = {
  id: 'agency-1',
  name: 'Your Car Your Way – Lyon Part-Dieu',
};

export function makeConversation(
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    id: 'conv-1',
    customerId: 'user-1',
    guestId: null,
    origin: 'GENERAL',
    agencyId: 'agency-central',
    bookingId: null,
    status: 'OPEN',
    openedAt: '2026-11-13T09:30:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

export function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderType: 'CUSTOMER',
    senderUserId: 'user-1',
    senderAgencyId: null,
    content: 'Bonjour',
    sentAt: '2026-11-13T09:31:00.000Z',
    senderAgency: null,
    senderUser: { customer: { firstName: 'Alice' } },
    ...overrides,
  };
}

export const customerSession: SessionUser = {
  id: 'user-1',
  email: 'alice@exemple.fr',
  role: 'CUSTOMER',
  agencyId: null,
};

export const agentSession: SessionUser = {
  id: 'agent-1',
  email: 'central@ycyw.test',
  role: 'AGENT',
  agencyId: 'agency-central',
};

export const customerProfile: UserProfile = {
  id: 'user-1',
  email: 'alice@exemple.fr',
  role: 'CUSTOMER',
  firstName: ['Alice'],
  lastName: ['Martin'],
};
