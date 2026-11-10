import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type {
  ChatMessage,
  SendMessagePayload,
  JoinConversationPayload,
  ChatServer,
  ChatSocket,
} from './chat.types';
import { AuthService } from 'src/auth/auth.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import { createWsAuthMiddleware } from './ws-auth.middleware';

@WebSocketGateway({
  cors: { origin: 'http://localhost:5173', credentials: true },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer() server!: ChatServer;

  constructor(
    private readonly authService: AuthService,
    private readonly conversationsService: ConversationsService,
  ) {}

  afterInit(server: Server) {
    server.use(createWsAuthMiddleware(this.authService));
  }

  @SubscribeMessage('message:send')
  handleSendMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ): { status: 'ok'; id: string } {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      authorId: client.id, // provisoire : sera l'id utilisateur issu du JWT
      content: payload.content,
      sentAt: new Date().toISOString(),
    };

    // Diffusion à tous les clients connectés, émetteur compris
    this.server.emit('message:new', message);

    // Accusé de réception, reçu uniquement par l'émetteur
    return { status: 'ok', id: message.id };
  }

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @MessageBody() payload: JoinConversationPayload,
    @ConnectedSocket() client: ChatSocket,
  ): Promise<{ status: 'ok'; conversationId: string }> {
    const room = `conversation:${payload.conversationId}`;

    await client.join(room);

    const message = {
      conversationId: payload.conversationId,
      userId: client.id, // provisoire : sera l'id utilisateur issu du JWT
      joinedAt: new Date().toISOString(),
    };

    client.to(room).emit('conversation:user-joined', message);
    return { status: 'ok', conversationId: payload.conversationId };
  }
}
