import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const registerSchema = z.object({
  email: z.email().meta({
    description: 'Adresse e-mail du client, utilisée comme identifiant',
    example: 'jean.dupont@example.com',
  }),
  password: z.string().min(12).max(128).meta({
    description: 'Mot de passe (12 à 128 caractères)',
  }),
  firstName: z.string().trim().min(1).max(100).meta({
    description: 'Prénom du client',
    example: 'Jean',
  }),
  lastName: z.string().trim().min(1).max(100).meta({
    description: 'Nom de famille du client',
    example: 'Dupont',
  }),
  birthDate: z.iso
    .date()
    .meta({
      description: 'Date de naissance du client (format AAAA-MM-JJ)',
      example: '1990-05-12',
    })
    .transform((value) => new Date(value)), // "1990-05-12" (texte du JSON) → objet Date
  address: z.string().trim().min(1).max(255).meta({
    description: 'Adresse postale du client',
    example: '12 rue de la République, 69002 Lyon',
  }),
});

export class RegisterDto extends createZodDto(registerSchema) {}
