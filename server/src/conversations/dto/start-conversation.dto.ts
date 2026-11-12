import z from 'zod';
import { createZodDto } from 'nestjs-zod';

export const startConversationSchema = z
  .object({
    origin: z.enum(['GENERAL', 'AGENCY']).meta({
      description:
        'Origine de la demande : GENERAL (service client central) ou AGENCY (agence précise)',
    }),
    agencyId: z.uuid().optional().meta({
      description:
        "Identifiant de l'agence contactée, obligatoire quand origin vaut AGENCY",
    }),
  })
  .refine((data) => data.origin !== 'AGENCY' || data.agencyId !== undefined, {
    message: 'agencyId est obligatoire quand origin vaut AGENCY',
    path: ['agencyId'],
  });

export class StartConversationDto extends createZodDto(
  startConversationSchema,
) {}
