import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import type {
  ChatMessage,
  SendMessagePayload,
  ChatServer,
  ChatSocket,
} from './chat.types';
import { AuthService } from '../auth/auth.service';
import { ConversationsService } from '../conversations/conversations.service';
import { createWsAuthMiddleware } from './ws-auth.middleware';
import { ZodValidationPipe } from 'nestjs-zod';
import { JoinConversationDto } from './dto/join-conversation.dto';

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

  private roomName(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
