import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import type { ConversationsRepository } from './conversations.repository';
import type { AgenciesService } from '../agencies/agencies.service';
import type { AccountsService } from '../accounts/accounts.service';
import type { Identity } from '../auth/auth.types';
import {
  AgencyType,
  ConversationOrigin,
  ConversationStatus,
  Role,
  SenderType,
} from '../generated/prisma/enums';

const LYON_ID = 'agency-lyon';
const PARIS_ID = 'agency-paris';
const CENTRAL = {
  id: 'agency-central',
  name: 'Service client central',
  agencyType: AgencyType.CENTRAL,
};
const LYON = {
  id: LYON_ID,
  name: 'Your Car Your Way – Lyon Part-Dieu',
  agencyType: AgencyType.BRANCH,
};

const guest: Identity = { kind: 'guest', guestId: 'guest-a' };
const otherGuest: Identity = { kind: 'guest', guestId: 'guest-b' };
const customer: Identity = {
  kind: 'user',
  id: 'customer-a',
  role: Role.CUSTOMER,
  agencyId: null,
};
const otherCustomer: Identity = {
  kind: 'user',
  id: 'customer-b',
  role: Role.CUSTOMER,
  agencyId: null,
};
const lyonAgent: Identity = {
  kind: 'user',
  id: 'agent-lyon',
  role: Role.AGENT,
  agencyId: LYON_ID,
};
const parisAgent: Identity = {
  kind: 'user',
  id: 'agent-paris',
  role: Role.AGENT,
  agencyId: PARIS_ID,
};
const anonymous: Identity = { kind: 'anonymous' };

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    customerId: null,
    guestId: null,
    origin: ConversationOrigin.AGENCY,
    agencyId: LYON_ID,
    bookingId: null,
    status: ConversationStatus.OPEN,
    openedAt: new Date('2026-11-12T09:00:00Z'),
    closedAt: null,
    ...overrides,
  };
}

describe('ConversationsService', () => {
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findOpenByOwner: jest.Mock;
    findOpenByAgencyId: jest.Mock;
    findMessages: jest.Mock;
    createMessage: jest.Mock;
    close: jest.Mock;
  };
  let agencies: {
    findById: jest.Mock;
    findCentral: jest.Mock;
  };
  let accounts: { getProfile: jest.Mock };
  let service: ConversationsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findOpenByOwner: jest.fn(),
      findOpenByAgencyId: jest.fn(),
      findMessages: jest.fn(),
      createMessage: jest.fn(),
      close: jest.fn(),
    };
    agencies = { findById: jest.fn(), findCentral: jest.fn() };
    accounts = { getProfile: jest.fn() };
    service = new ConversationsService(
      repository as unknown as ConversationsRepository,
      agencies as unknown as AgenciesService,
      accounts as unknown as AccountsService,
    );
  });

  describe('assertCanAccess', () => {
    const owned = conversation({
      guestId: 'guest-a',
      customerId: null,
    });
    const ownedByCustomer = conversation({
      guestId: null,
      customerId: 'customer-a',
    });

    it.each([
      ['l’invité propriétaire', guest, owned],
      ['le client propriétaire', customer, ownedByCustomer],
      ['un agent de l’agence de la conversation', lyonAgent, owned],
    ])('autorise %s', async (_label, identity, existing) => {
      repository.findById.mockResolvedValue(existing);

      await expect(
        service.assertCanAccess(identity, existing.id),
      ).resolves.toBe(existing);
    });

    it.each([
      ['un autre invité', otherGuest, owned],
      ['un autre client', otherCustomer, ownedByCustomer],
      ['un client sur la conversation d’un invité', customer, owned],
      ['un agent d’une autre agence', parisAgent, owned],
      ['un visiteur anonyme', anonymous, owned],
    ])('refuse %s (403)', async (_label, identity, existing) => {
      repository.findById.mockResolvedValue(existing);

      await expect(
        service.assertCanAccess(identity, existing.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('renvoie 404 quand la conversation est introuvable', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.assertCanAccess(guest, 'inconnue'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertCanJoin', () => {
    it('renvoie la conversation ouverte accessible', async () => {
      const existing = conversation({ guestId: 'guest-a' });
      repository.findById.mockResolvedValue(existing);

      await expect(service.assertCanJoin(guest, existing.id)).resolves.toBe(
        existing,
      );
    });

    it('refuse une conversation fermée avec le code CONVERSATION_CLOSED', async () => {
      repository.findById.mockResolvedValue(
        conversation({ guestId: 'guest-a', status: ConversationStatus.CLOSED }),
      );

      const error: unknown = await service
        .assertCanJoin(guest, 'conversation-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'CONVERSATION_CLOSED',
      });
    });
  });

  describe('startConversation', () => {
    it('renvoie la conversation ouverte existante sans en créer une nouvelle', async () => {
      const existing = conversation({ guestId: 'guest-a' });
      repository.findOpenByOwner.mockResolvedValue(existing);

      await expect(
        service.startConversation(guest, {
          origin: ConversationOrigin.GENERAL,
        }),
      ).resolves.toBe(existing);
      expect(repository.findOpenByOwner).toHaveBeenCalledWith({
        guestId: 'guest-a',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rattache une demande GENERAL à l’agence centrale', async () => {
      repository.findOpenByOwner.mockResolvedValue(null);
      agencies.findCentral.mockResolvedValue(CENTRAL);
      repository.create.mockImplementation((data: object) => ({
        id: 'nouvelle',
        ...data,
      }));

      await service.startConversation(customer, {
        origin: ConversationOrigin.GENERAL,
      });

      expect(repository.create).toHaveBeenCalledWith({
        customerId: 'customer-a',
        guestId: null,
        origin: ConversationOrigin.GENERAL,
        agencyId: CENTRAL.id,
      });
    });

    it('échoue explicitement quand l’agence centrale est absente', async () => {
      repository.findOpenByOwner.mockResolvedValue(null);
      agencies.findCentral.mockResolvedValue(null);

      await expect(
        service.startConversation(guest, {
          origin: ConversationOrigin.GENERAL,
        }),
      ).rejects.toThrow('Agence centrale absente');
    });

    it('rattache une demande AGENCY à l’agence locale demandée', async () => {
      repository.findOpenByOwner.mockResolvedValue(null);
      agencies.findById.mockResolvedValue(LYON);

      await service.startConversation(guest, {
        origin: ConversationOrigin.AGENCY,
        agencyId: LYON_ID,
      });

      expect(agencies.findById).toHaveBeenCalledWith(LYON_ID);
      expect(repository.create).toHaveBeenCalledWith({
        customerId: null,
        guestId: 'guest-a',
        origin: ConversationOrigin.AGENCY,
        agencyId: LYON_ID,
      });
    });

    it('refuse une demande AGENCY sans agencyId (400)', async () => {
      repository.findOpenByOwner.mockResolvedValue(null);

      await expect(
        service.startConversation(guest, { origin: ConversationOrigin.AGENCY }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('refuse une agence inexistante (404)', async () => {
      repository.findOpenByOwner.mockResolvedValue(null);
      agencies.findById.mockResolvedValue(null);

      await expect(
        service.startConversation(guest, {
          origin: ConversationOrigin.AGENCY,
          agencyId: 'inconnue',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse l’agence centrale pour une demande AGENCY (404)', async () => {
      repository.findOpenByOwner.mockResolvedValue(null);
      agencies.findById.mockResolvedValue(CENTRAL);

      await expect(
        service.startConversation(guest, {
          origin: ConversationOrigin.AGENCY,
          agencyId: CENTRAL.id,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un agent (403)', async () => {
      await expect(
        service.startConversation(lyonAgent, {
          origin: ConversationOrigin.GENERAL,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuse un visiteur anonyme (401)', async () => {
      await expect(
        service.startConversation(anonymous, {
          origin: ConversationOrigin.GENERAL,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('postMessage', () => {
    it('enregistre le message avec l’auteur déduit de l’identité', async () => {
      repository.findById.mockResolvedValue(conversation());
      repository.createMessage.mockResolvedValue({ id: 'message-1' });

      await service.postMessage(lyonAgent, 'conversation-1', 'Bonjour');

      expect(repository.createMessage).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        senderType: SenderType.AGENT,
        senderUserId: 'agent-lyon',
        senderAgencyId: LYON_ID,
        content: 'Bonjour',
      });
    });

    it('refuse un message sur une conversation fermée avec CONVERSATION_CLOSED', async () => {
      repository.findById.mockResolvedValue(
        conversation({ guestId: 'guest-a', status: ConversationStatus.CLOSED }),
      );

      const error: unknown = await service
        .postMessage(guest, 'conversation-1', 'Bonjour')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'CONVERSATION_CLOSED',
      });
      expect(repository.createMessage).not.toHaveBeenCalled();
    });
  });

  describe('closeConversation', () => {
    it('ferme une conversation ouverte', async () => {
      const closed = conversation({ status: ConversationStatus.CLOSED });
      repository.findById.mockResolvedValue(conversation());
      repository.close.mockResolvedValue(closed);

      await expect(
        service.closeConversation(lyonAgent, 'conversation-1'),
      ).resolves.toBe(closed);
      expect(repository.close).toHaveBeenCalledWith('conversation-1');
    });

    it('refuse de fermer une conversation déjà fermée avec CONVERSATION_CLOSED', async () => {
      repository.findById.mockResolvedValue(
        conversation({ status: ConversationStatus.CLOSED }),
      );

      await expect(
        service.closeConversation(lyonAgent, 'conversation-1'),
      ).rejects.toMatchObject({
        response: { code: 'CONVERSATION_CLOSED' },
      });
      expect(repository.close).not.toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('renvoie l’historique après vérification de l’accès', async () => {
      repository.findById.mockResolvedValue(conversation());
      repository.findMessages.mockResolvedValue([]);

      await expect(
        service.getMessages(lyonAgent, 'conversation-1'),
      ).resolves.toEqual([]);
      expect(repository.findMessages).toHaveBeenCalledWith('conversation-1');
    });

    it('ne lit pas l’historique quand l’accès est refusé', async () => {
      repository.findById.mockResolvedValue(conversation());

      await expect(
        service.getMessages(parisAgent, 'conversation-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.findMessages).not.toHaveBeenCalled();
    });
  });

  describe('listOpenForAgent', () => {
    it('liste les conversations ouvertes de l’agence de l’agent', async () => {
      repository.findOpenByAgencyId.mockResolvedValue([]);

      await service.listOpenForAgent(lyonAgent);

      expect(repository.findOpenByAgencyId).toHaveBeenCalledWith(LYON_ID);
    });

    it.each([
      ['un client', customer],
      ['un invité', guest],
      ['un visiteur anonyme', anonymous],
      ['un agent sans agence', { ...lyonAgent, agencyId: null }],
    ])('refuse %s (403)', async (_label, identity) => {
      await expect(service.listOpenForAgent(identity)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('findCurrent', () => {
    it('cherche la conversation ouverte du client', async () => {
      repository.findOpenByOwner.mockResolvedValue(null);

      await expect(service.findCurrent(customer)).resolves.toBeNull();
      expect(repository.findOpenByOwner).toHaveBeenCalledWith({
        customerId: 'customer-a',
      });
    });
  });

  describe('getParticipant', () => {
    it('présente un invité sans nom', async () => {
      await expect(service.getParticipant(guest)).resolves.toEqual({
        type: SenderType.GUEST,
        displayName: null,
      });
    });

    it('présente un client par son prénom', async () => {
      accounts.getProfile.mockResolvedValue({ firstName: 'Jean' });

      await expect(service.getParticipant(customer)).resolves.toEqual({
        type: SenderType.CUSTOMER,
        displayName: 'Jean',
      });
      expect(accounts.getProfile).toHaveBeenCalledWith('customer-a');
    });

    it('présente un agent par le nom de son agence', async () => {
      agencies.findById.mockResolvedValue(LYON);

      await expect(service.getParticipant(lyonAgent)).resolves.toEqual({
        type: SenderType.AGENT,
        displayName: LYON.name,
      });
    });

    it('refuse un visiteur anonyme (403)', async () => {
      await expect(service.getParticipant(anonymous)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
