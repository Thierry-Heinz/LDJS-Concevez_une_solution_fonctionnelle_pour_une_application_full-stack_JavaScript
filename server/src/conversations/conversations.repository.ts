import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationStatus } from '../generated/prisma/enums';
import type {
  ConversationOwner,
  CreateConversationData,
  CreateMessageData,
} from './conversations.types';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateConversationData) {
    return this.prisma.conversation.create({ data });
  }

  findById(id: string) {
    return this.prisma.conversation.findUnique({ where: { id } });
  }

  findOpenByOwner(owner: ConversationOwner) {
    return this.prisma.conversation.findFirst({
      where: { ...owner, status: ConversationStatus.OPEN },
    });
  }

  findOpenByAgencyId(agencyId: string) {
    return this.prisma.conversation.findMany({
      where: { agencyId, status: ConversationStatus.OPEN },
      orderBy: { openedAt: 'asc' },
    });
  }

  findMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
    });
  }

  createMessage(data: CreateMessageData) {
    return this.prisma.message.create({ data });
  }
}
