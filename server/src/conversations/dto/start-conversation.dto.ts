import z from 'zod';
import { createZodDto } from 'nestjs-zod';

export const startConversationSchema = z
  .object({
    origin: z.enum(['GENERAL', 'AGENCY']),
    agencyId: z.uuid().optional(),
  })
  .refine((data) => data.origin !== 'AGENCY' || data.agencyId !== undefined, {
    message: 'agencyId est obligatoire quand origin vaut AGENCY',
    path: ['agencyId'],
  });

export class StartConversationDto extends createZodDto(
  startConversationSchema,
) {}
