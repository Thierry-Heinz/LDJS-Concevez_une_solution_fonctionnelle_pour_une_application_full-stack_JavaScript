import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthService } from 'src/auth/auth.service';
import { ConversationsService } from 'src/conversations/conversations.service';

@Module({
  imports: [AuthService, ConversationsService],
  providers: [ChatGateway],
})
export class ChatModule {}
