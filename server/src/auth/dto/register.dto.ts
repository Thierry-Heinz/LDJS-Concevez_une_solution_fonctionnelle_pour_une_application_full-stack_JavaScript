import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  birthDate: z.coerce.date(), // "1990-05-12" (texte du JSON) → objet Date
  address: z.string().trim().min(1).max(255),
});

export class RegisterDto extends createZodDto(registerSchema) {}
