import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
});

export class LoginDto extends createZodDto(loginSchema) {}
