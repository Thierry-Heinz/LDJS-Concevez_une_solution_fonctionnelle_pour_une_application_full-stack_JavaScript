import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const refreshedUserSchema = z.object({
  id: z.uuid().meta({ description: "Identifiant de l'utilisateur" }),
  role: z
    .enum(['CUSTOMER', 'AGENT'])
    .meta({ description: "Rôle de l'utilisateur : client ou agent" }),
  agencyId: z.uuid().nullable().meta({
    description:
      "Identifiant de l'agence de rattachement (null pour un client)",
  }),
});

export const sessionUserSchema = refreshedUserSchema.extend({
  email: z.email().meta({ description: "Adresse e-mail de l'utilisateur" }),
});

export class SessionUserDto extends createZodDto(sessionUserSchema) {}

export class RefreshedUserDto extends createZodDto(refreshedUserSchema) {}
