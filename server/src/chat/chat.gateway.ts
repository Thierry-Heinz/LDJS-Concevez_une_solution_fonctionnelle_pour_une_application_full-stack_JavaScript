import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseFilters } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import type { ChatServer, ChatSocket } from './chat.types';
import type { MessageSentAck, OkAck } from './chat.events';
import { AuthService } from '../auth/auth.service';
import { ConversationsService } from '../conversations/conversations.service';
import { createWsAuthMiddleware } from './ws-auth.middleware';
import { JoinConversationDto } from './dto/join-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { WsExceptionsFilter } from './ws-exceptions.filter';

/**
 * Événements Socket.IO du chat. Le contrat complet (payloads, acks, erreurs)
 * est dans `chat.events.ts`. Une conversation correspond à une room
 * `conversation:<id>`.
 */
@UseFilters(new WsExceptionsFilter())
// CORS : configuré par ChatIoAdapter à partir de CLIENT_ORIGIN
@WebSocketGateway()
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer() server!: ChatServer;

  constructor(
    private readonly authService: AuthService,
    private readonly conversationsService: ConversationsService,
  ) {}

  afterInit(server: ChatServer) {
    server.use(createWsAuthMiddleware(this.authService));
  }

  /**
   * Fait entrer le socket dans la room de la conversation et prévient les
   * participants déjà présents.
   */
  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @MessageBody(new ZodValidationPipe(JoinConversationDto))
    payload: JoinConversationDto,

    @ConnectedSocket() client: ChatSocket,
  ): Promise<OkAck> {
    const identity = client.data.identity;

    await this.conversationsService.assertCanJoin(
      identity,
      payload.conversationId,
    );
    const participant =
      await this.conversationsService.getParticipant(identity);
    const roomName = this.roomName(payload.conversationId);

    await client.join(roomName);

    client.to(roomName).emit('conversation:participant-joined', {
      conversationId: payload.conversationId,
      participant,
      joinedAt: new Date().toISOString(),
    });
    return { status: 'ok' };
  }

  /**
   * Enregistre le message et le diffuse à toute la room, auteur compris.
   *
   * @returns l'ack avec l'id du message.
   */
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @MessageBody(new ZodValidationPipe(SendMessageDto)) payload: SendMessageDto,
    @ConnectedSocket() client: ChatSocket,
  ): Promise<MessageSentAck> {
    const identity = client.data.identity;
    const roomName = this.roomName(payload.conversationId);
    const message = await this.conversationsService.postMessage(
      identity,
      payload.conversationId,
      payload.content,
    );

    this.server.to(roomName).emit('message:new', {
      ...message,
      sentAt: message.sentAt.toISOString(),
    });
    return { status: 'ok', id: message.id };
  }

  /**
   * Ferme la conversation, prévient la room, puis en retire tous les sockets.
   */
  @SubscribeMessage('conversation:close')
  async handleCloseConversation(
    @MessageBody(new ZodValidationPipe(JoinConversationDto))
    payload: JoinConversationDto,
    @ConnectedSocket() client: ChatSocket,
  ): Promise<OkAck> {
    const identity = client.data.identity;

    const roomName = this.roomName(payload.conversationId);
    const conversation = await this.conversationsService.closeConversation(
      identity,
      payload.conversationId,
    );
    const closedBy = await this.conversationsService.getParticipant(identity);

    this.server.to(roomName).emit('conversation:closed', {
      conversationId: payload.conversationId,
      closedAt: (conversation.closedAt ?? new Date()).toISOString(),
      closedBy,
    });
    this.server.in(roomName).socketsLeave(roomName);
    return { status: 'ok' };
  }

  private roomName(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
