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
import type { Identity } from '../auth/auth.types';
import {
  AgencyType,
  ConversationOrigin,
  ConversationStatus,
  Role,
  SenderType,
} from '../generated/prisma/enums';
import type { ConversationOwner, Participant } from './conversations.types';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly agenciesService: AgenciesService,
    private readonly accountsService: AccountsService,
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
    const owner = this.toOwner(identity);

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

  async postMessage(
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
      identity.kind !== 'user' ||
      identity.role !== Role.AGENT ||
      identity.agencyId === null
    ) {
      throw new ForbiddenException();
    }

    return this.conversationsRepository.findOpenByAgencyId(identity.agencyId);
  }

  async findCurrent(identity: Identity) {
    return this.conversationsRepository.findOpenByOwner(this.toOwner(identity));
  }

  resolveSender(identity: Identity): {
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

  async getParticipant(identity: Identity): Promise<Participant> {
    const sender = this.resolveSender(identity);

    const participant = {
      type: sender.senderType,
    };

    switch (sender.senderType) {
      case SenderType.GUEST:
        return { ...participant, displayName: null };

      case SenderType.CUSTOMER: {
        if (!sender.senderUserId) {
          throw new UnauthorizedException();
        }
        const user = await this.accountsService.getProfile(sender.senderUserId);
        return { ...participant, displayName: user?.firstName ?? null };
      }

      case SenderType.AGENT: {
        if (!sender.senderAgencyId) {
          throw new UnauthorizedException();
        }
        const agency = await this.agenciesService.findById(
          sender.senderAgencyId,
        );
        return { ...participant, displayName: agency?.name ?? null };
      }
    }
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
    if (!agency || agency.agencyType !== AgencyType.BRANCH) {
      throw new NotFoundException();
    }
    return agency;
  }

  private toOwner(identity: Identity): ConversationOwner {
    switch (identity.kind) {
      case 'user':
        if (identity.role !== Role.CUSTOMER) {
          throw new ForbiddenException();
        }
        return { customerId: identity.id };
      case 'guest':
        return { guestId: identity.guestId };
      case 'anonymous':
        throw new UnauthorizedException();
    }
  }
}
