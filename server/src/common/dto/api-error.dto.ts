import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Corps des réponses d'erreur HTTP. Trois formes existent :
// - erreurs Nest (400 UUID, 401, 403, 404) : { statusCode, message, error }
// - validation Zod (400) : { statusCode, message, errors }
// - erreurs à code métier (409) : { code, message, conversationId? }
export const apiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599).optional().meta({
    description: 'Code HTTP (absent des erreurs à code métier)',
    example: 404,
  }),
  message: z.string().meta({
    description: "Message d'erreur",
    example: 'Not Found',
  }),
  error: z.string().optional().meta({
    description: 'Libellé du statut HTTP (erreurs Nest)',
    example: 'Not Found',
  }),
  code: z.string().optional().meta({
    description:
      'Code métier : EMAIL_ALREADY_USED, CONVERSATION_ALREADY_OPEN ou CONVERSATION_CLOSED',
    example: 'CONVERSATION_ALREADY_OPEN',
  }),
  errors: z.array(z.unknown()).optional().meta({
    description: 'Détail des erreurs de validation Zod (400)',
  }),
  conversationId: z.uuid().optional().meta({
    description:
      'Conversation déjà ouverte, avec le code CONVERSATION_ALREADY_OPEN',
  }),
});

export class ApiErrorDto extends createZodDto(apiErrorSchema) {}
