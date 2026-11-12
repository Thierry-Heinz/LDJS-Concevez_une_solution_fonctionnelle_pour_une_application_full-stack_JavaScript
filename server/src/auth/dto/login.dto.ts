import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const loginSchema = z.object({
  email: z.email().meta({
    description: 'Adresse e-mail du compte',
    example: 'jean.dupont@example.com',
  }),
  password: z.string().min(1).meta({ description: 'Mot de passe du compte' }),
});

export class LoginDto extends createZodDto(loginSchema) {}
