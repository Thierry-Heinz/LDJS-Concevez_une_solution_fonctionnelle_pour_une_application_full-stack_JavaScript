import { ConversationOrigin, SenderType } from '../generated/prisma/enums';

export type CreateConversationData = {
  customerId: string | null;
  guestId: string | null;
  origin: ConversationOrigin;
  agencyId: string;
};

export type CreateMessageData = {
  conversationId: string;
  senderType: SenderType;
  senderUserId: string | null;
  senderAgencyId: string | null;
  content: string;
};

export type ConversationOwner = { customerId: string } | { guestId: string };
