import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const agencySchema = z.object({
  id: z.uuid().meta({ description: "Identifiant de l'agence" }),
  name: z.string().meta({
    description: "Nom de l'agence",
    example: 'Your Car Your Way — Lyon Part-Dieu',
  }),
});

export class AgencyDto extends createZodDto(agencySchema) {}
