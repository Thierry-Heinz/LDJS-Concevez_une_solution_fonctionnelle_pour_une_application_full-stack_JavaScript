import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const sendMessageSchema = z.object({
  conversationId: z.uuid(),
  content: z.string().trim().min(1).max(2000),
});

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
