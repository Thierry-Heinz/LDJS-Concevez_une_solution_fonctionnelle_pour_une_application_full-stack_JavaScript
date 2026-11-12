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

  /**
   * Vérifie que l'appelant peut lire ou écrire dans la conversation : un invité
   * ou un client sur la sienne, un agent sur celles de son agence.
   *
   * @returns la conversation.
   * @throws UnauthorizedException (anonyme), NotFoundException, ForbiddenException.
   */
  async assertCanAccess(identity: Identity, conversationId: string) {
    this.assertIdentified(identity);
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

  /**
   * Comme `assertCanAccess`, et refuse en plus une conversation fermée.
   *
   * @throws ConflictException `CONVERSATION_CLOSED`.
   */
  async assertCanJoin(identity: Identity, conversationId: string) {
    const conversation = await this.assertCanAccess(identity, conversationId);
    this.assertOpen(conversation.status);
    return conversation;
  }

  /**
   * Ouvre une conversation vers le service central (GENERAL) ou une agence
   * locale (AGENCY). Un client ou un invité n'en a qu'une ouverte à la fois : si
   * elle vise la même cible, elle est renvoyée.
   *
   * @returns `{ conversation, created }`.
   * @throws ConflictException `CONVERSATION_ALREADY_OPEN` si la conversation
   * ouverte vise une autre cible.
   */
  async startConversation(
    identity: Identity,
    input: { origin: ConversationOrigin; agencyId?: string },
  ) {
    const owner = this.toOwner(identity);

    // Une seule conversation ouverte par client ou invité
    const existing = await this.conversationsRepository.findOpenByOwner(owner);
    if (existing) {
      if (!this.isSameTarget(existing, input)) {
        throw new ConflictException({
          code: 'CONVERSATION_ALREADY_OPEN',
          message:
            'Une conversation est déjà ouverte vers un autre destinataire',
          conversationId: existing.id,
        });
      }
      return { conversation: existing, created: false };
    }

    const agency = await this.resolveAgency(input);
    const conversation = await this.conversationsRepository.create({
      customerId: 'customerId' in owner ? owner.customerId : null,
      guestId: 'guestId' in owner ? owner.guestId : null,
      origin: input.origin,
      agencyId: agency.id,
    });
    return { conversation, created: true };
  }

  /**
   * Ferme une conversation ouverte.
   *
   * @throws ConflictException `CONVERSATION_CLOSED` si elle l'est déjà.
   */
  async closeConversation(identity: Identity, conversationId: string) {
    const conversation = await this.assertCanAccess(identity, conversationId);
    this.assertOpen(conversation.status);
    return await this.conversationsRepository.close(conversationId);
  }

  /**
   * @returns l'historique des messages, du plus ancien au plus récent, après
   * vérification de l'accès.
   */
  async getMessages(identity: Identity, conversationId: string) {
    await this.assertCanAccess(identity, conversationId);
    return this.conversationsRepository.findMessages(conversationId);
  }

  /**
   * Enregistre un message ; l'auteur (type, utilisateur, agence) est déduit
   * de l'identité.
   *
   * @throws ConflictException `CONVERSATION_CLOSED` si la conversation est fermée.
   */
  async postMessage(
    identity: Identity,
    conversationId: string,
    content: string,
  ) {
    const conversation = await this.assertCanAccess(identity, conversationId);
    this.assertOpen(conversation.status);

    const sender = this.resolveSender(identity);
    return this.conversationsRepository.createMessage({
      conversationId,
      ...sender,
      content,
    });
  }

  /**
   * @returns les conversations ouvertes de l'agence de l'agent, de la plus
   * ancienne à la plus récente.
   * @throws ForbiddenException si l'appelant n'est pas un agent rattaché à une
   * agence.
   */
  async listOpenForAgent(identity: Identity) {
    this.assertIdentified(identity);
    if (
      identity.kind !== 'user' ||
      identity.role !== Role.AGENT ||
      identity.agencyId === null
    ) {
      throw new ForbiddenException();
    }

    return this.conversationsRepository.findOpenByAgencyId(identity.agencyId);
  }

  /**
   * @returns la conversation ouverte du client ou de l'invité, ou `null`.
   */
  async findCurrent(identity: Identity) {
    return this.conversationsRepository.findOpenByOwner(this.toOwner(identity));
  }

  /**
   * Traduit une identité en auteur de message, au format des colonnes
   * `sender_*` de la table `messages`.
   */
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
        throw new UnauthorizedException();
    }
  }

  /**
   * @returns le participant tel qu'il est affiché dans le chat : invité sans
   * nom, client par son prénom, agent par le nom de son agence.
   */
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

  /**
   * Règle d'accès à une conversation, sans accès à la base.
   */
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

  /**
   * Trouve l'agence destinataire : l'agence centrale pour GENERAL, l'agence
   * locale demandée pour AGENCY.
   *
   * @throws BadRequestException si `agencyId` manque, NotFoundException si
   * l'agence n'existe pas ou n'est pas une agence locale.
   */
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

  /**
   * Traduit une identité en propriétaire de conversation (`customerId` ou
   * `guestId`).
   *
   * @throws ForbiddenException pour un agent, UnauthorizedException pour un
   * anonyme.
   */
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

  /**
   * Refuse un appelant anonyme avec 401. Le 403 reste réservé à une identité
   * connue qui n'a pas le droit.
   */
  private assertIdentified(identity: Identity) {
    if (identity.kind === 'anonymous') {
      throw new UnauthorizedException();
    }
  }

  /**
   * Indique si une conversation ouverte vise déjà la cible demandée.
   */
  private isSameTarget(
    existing: { origin: ConversationOrigin; agencyId: string },
    input: { origin: ConversationOrigin; agencyId?: string },
  ) {
    if (existing.origin !== input.origin) {
      return false;
    }
    return (
      input.origin === ConversationOrigin.GENERAL ||
      existing.agencyId === input.agencyId
    );
  }

  private assertOpen(conversationStatus: ConversationStatus) {
    if (conversationStatus === ConversationStatus.CLOSED) {
      throw new ConflictException({
        code: 'CONVERSATION_CLOSED',
        message: 'Conversation fermée',
      });
    }
  }
}
