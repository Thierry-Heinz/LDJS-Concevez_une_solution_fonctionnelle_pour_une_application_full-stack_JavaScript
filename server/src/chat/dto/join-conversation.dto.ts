import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const joinConversationSchema = z.object({
  conversationId: z.uuid(),
});

export class JoinConversationDto extends createZodDto(joinConversationSchema) {}
