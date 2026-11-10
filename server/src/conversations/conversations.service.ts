import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AgenciesService } from '../agencies/agencies.service';
import { ConversationsRepository } from './conversations.repository';
import { Identity } from '../auth/auth.types';
import {
  ConversationOrigin,
  ConversationStatus,
  Role,
  SenderType,
} from '../generated/prisma/enums';
import { ConversationOwner } from './conversations.types';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly agenciesService: AgenciesService,
  ) {}

  async assertCanAccess(identity: Identity, conversationId: string) {
    const conversation =
      await this.conversationsRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException();
    }
    if (!this.canAccess(identity, conversation)) {
      throw new ForbiddenException();
    }
    return conversation;
  }

  async startConversation(
    identity: Identity,
    input: { origin: ConversationOrigin; agencyId?: string },
  ) {
    let owner: ConversationOwner;
    switch (identity.kind) {
      case 'user':
        if (identity.role !== Role.CUSTOMER) {
          throw new ForbiddenException(); // un agent n'ouvre pas de conversation
        }
        owner = { customerId: identity.id };
        break;
      case 'guest':
        owner = { guestId: identity.guestId };
        break;
      case 'anonymous':
        throw new UnauthorizedException();
    }

    const existing = await this.conversationsRepository.findOpenByOwner(owner);
    if (existing) {
      return existing;
    }

    const agency = await this.resolveAgency(input);
    return this.conversationsRepository.create({
      customerId: 'customerId' in owner ? owner.customerId : null,
      guestId: 'guestId' in owner ? owner.guestId : null,
      origin: input.origin,
      agencyId: agency.id,
    });
  }

  async getMessages(identity: Identity, conversationId: string) {
    await this.assertCanAccess(identity, conversationId);
    return this.conversationsRepository.findMessages(conversationId);
  }

  async postMessages(
    identity: Identity,
    conversationId: string,
    content: string,
  ) {
    const conversation = await this.assertCanAccess(identity, conversationId);
    if (conversation.status === ConversationStatus.CLOSED) {
      throw new ConflictException();
    }

    const sender = this.resolveSender(identity);
    return this.conversationsRepository.createMessage({
      conversationId,
      ...sender,
      content,
    });
  }

  async listOpenForAgent(identity: Identity) {
    if (
      identity.kind === 'guest' ||
      identity.kind === 'anonymous' ||
      identity.agencyId === null
    ) {
      throw new ForbiddenException();
    }

    return this.conversationsRepository.findOpenByAgencyId(identity.agencyId);
  }

  private canAccess(
    identity: Identity,
    conversation: {
      customerId: string | null;
      guestId: string | null;
      agencyId: string;
    },
  ): boolean {
    switch (identity.kind) {
      case 'guest':
        return conversation.guestId === identity.guestId;
      case 'user':
        if (identity.role === Role.CUSTOMER) {
          return conversation.customerId === identity.id;
        }
        if (identity.role === Role.AGENT) {
          return conversation.agencyId === identity.agencyId;
        }
        return false;
      case 'anonymous':
        return false;
    }
  }

  private async resolveAgency(input: {
    origin: ConversationOrigin;
    agencyId?: string;
  }) {
    if (input.origin === ConversationOrigin.GENERAL) {
      const central = await this.agenciesService.findCentral();
      if (!central) {
        throw new Error('Agence centrale absente : le seed a-t-il été lancé ?');
      }
      return central;
    }

    if (!input.agencyId) {
      throw new BadRequestException();
    }
    const agency = await this.agenciesService.findById(input.agencyId);
    if (!agency) {
      throw new NotFoundException();
    }
    return agency;
  }

  private resolveSender(identity: Identity): {
    senderType: SenderType;
    senderUserId: string | null;
    senderAgencyId: string | null;
  } {
    switch (identity.kind) {
      case 'guest':
        return {
          senderType: SenderType.GUEST,
          senderUserId: null,
          senderAgencyId: null,
        };
      case 'user':
        if (identity.role === Role.CUSTOMER) {
          return {
            senderType: SenderType.CUSTOMER,
            senderUserId: identity.id,
            senderAgencyId: null,
          };
        }
        if (identity.role === Role.AGENT) {
          return {
            senderType: SenderType.AGENT,
            senderUserId: identity.id,
            senderAgencyId: identity.agencyId,
          };
        }
        throw new ForbiddenException();
      case 'anonymous':
        throw new ForbiddenException();
    }
  }
}
