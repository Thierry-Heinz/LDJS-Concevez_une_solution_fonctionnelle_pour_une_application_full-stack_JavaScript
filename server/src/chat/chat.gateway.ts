import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { ChatServer, ChatSocket } from './chat.types';
import { AuthService } from '../auth/auth.service';
import { ConversationsService } from '../conversations/conversations.service';
import { createWsAuthMiddleware } from './ws-auth.middleware';
import { ZodValidationPipe } from 'nestjs-zod';
import { JoinConversationDto } from './dto/join-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({
  cors: { origin: 'http://localhost:5173', credentials: true },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer() server!: ChatServer;

  constructor(
    private readonly authService: AuthService,
    private readonly conversationsService: ConversationsService,
  ) {}

  afterInit(server: ChatServer) {
    server.use(createWsAuthMiddleware(this.authService));
  }

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @MessageBody(new ZodValidationPipe(JoinConversationDto))
    payload: JoinConversationDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const identity = client.data.identity;

    await this.conversationsService.assertCanAccess(
      identity,
      payload.conversationId,
    );
    const participant =
      await this.conversationsService.getParticipant(identity);
    const roomName = this.roomName(payload.conversationId);

    await client.join(roomName);
    const sockets = await this.server.in(roomName).fetchSockets();
    console.log(
      `[join] ${identity.kind} → ${roomName} (${sockets.length} socket(s) dans la room)`,
    );
    client.to(roomName).emit('conversation:participant-joined', {
      conversationId: payload.conversationId,
      participant,
      joinedAt: new Date().toISOString(),
    });
    return { status: 'ok' as const };
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @MessageBody(new ZodValidationPipe(SendMessageDto)) payload: SendMessageDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const identity = client.data.identity;
    const roomName = this.roomName(payload.conversationId);
    const message = await this.conversationsService.postMessage(
      identity,
      payload.conversationId,
      payload.content,
    );

    this.server.to(roomName).emit('message:new', message);
    return { status: 'ok', id: message.id };
  }

  private roomName(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
