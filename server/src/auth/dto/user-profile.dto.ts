import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const userProfileSchema = z.object({
  id: z.uuid().meta({ description: "Identifiant de l'utilisateur" }),
  email: z.email().meta({ description: "Adresse e-mail de l'utilisateur" }),
  role: z
    .enum(['CUSTOMER', 'AGENT'])
    .meta({ description: "Rôle de l'utilisateur : client ou agent" }),
  firstName: z.string().nullable().meta({
    description: 'Prénom du client (null pour un agent)',
  }),
  lastName: z.string().nullable().meta({
    description: 'Nom de famille du client (null pour un agent)',
  }),
});

export class UserProfileDto extends createZodDto(userProfileSchema) {}
