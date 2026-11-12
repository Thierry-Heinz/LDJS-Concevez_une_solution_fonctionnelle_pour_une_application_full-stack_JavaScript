import z from 'zod';
import { createZodDto } from 'nestjs-zod';

export const conversationSchema = z.object({
  id: z.uuid().meta({ description: 'Identifiant de la conversation' }),
  customerId: z.uuid().nullable().meta({
    description: 'Identifiant du client propriétaire (null pour un invité)',
  }),
  guestId: z.uuid().nullable().meta({
    description: "Identifiant de l'invité propriétaire (null pour un client)",
  }),
  origin: z.enum(['GENERAL', 'AGENCY']).meta({
    description:
      'Origine de la demande : GENERAL (service client central) ou AGENCY (agence précise)',
  }),
  agencyId: z.uuid().meta({
    description: "Identifiant de l'agence qui traite la conversation",
  }),
  bookingId: z.uuid().nullable().meta({
    description:
      'Identifiant de la réservation concernée (non utilisé dans le PoC)',
  }),
  status: z
    .enum(['OPEN', 'CLOSED'])
    .meta({ description: 'Statut de la conversation : ouverte ou fermée' }),
  openedAt: z.iso
    .datetime()
    .meta({ description: "Date et heure d'ouverture (ISO 8601)" }),
  closedAt: z.iso.datetime().nullable().meta({
    description: 'Date et heure de fermeture (ISO 8601), null si ouverte',
  }),
});

export class ConversationDto extends createZodDto(conversationSchema) {}
