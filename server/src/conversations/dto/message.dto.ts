import z from 'zod';
import { createZodDto } from 'nestjs-zod';

export const messageSchema = z.object({
  id: z.uuid().meta({ description: 'Identifiant du message' }),
  conversationId: z
    .uuid()
    .meta({ description: 'Identifiant de la conversation du message' }),
  senderType: z.enum(['GUEST', 'CUSTOMER', 'AGENT']).meta({
    description: "Type d'auteur du message : invité, client ou agent",
  }),
  senderUserId: z.uuid().nullable().meta({
    description: "Identifiant de l'utilisateur auteur (null pour un invité)",
  }),
  senderAgencyId: z.uuid().nullable().meta({
    description: "Identifiant de l'agence de l'agent auteur (null sinon)",
  }),
  content: z.string().meta({ description: 'Contenu textuel du message' }),
  sentAt: z.iso
    .datetime()
    .meta({ description: "Date et heure d'envoi (ISO 8601)" }),
  senderAgency: z
    .object({
      name: z.string().meta({ description: "Nom de l'agence" }),
    })
    .nullable()
    .meta({
      description: "Agence de l'agent auteur, affichée comme nom d'expéditeur",
    }),
  senderUser: z
    .object({
      customer: z
        .object({
          firstName: z.string().meta({ description: 'Prénom du client' }),
        })
        .nullable()
        .meta({ description: 'Fiche client (null pour un agent)' }),
    })
    .nullable()
    .meta({ description: 'Utilisateur auteur (null pour un invité)' }),
});

export class MessageDto extends createZodDto(messageSchema) {}
