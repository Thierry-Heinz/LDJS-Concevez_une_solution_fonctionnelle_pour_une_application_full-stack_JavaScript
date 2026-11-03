import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// Forme des données envoyées par le client
interface SendMessagePayload {
  content: string;
}

// Forme du message diffusé par le serveur
interface ChatMessage {
  id: string;
  authorId: string;
  content: string;
  sentAt: string; // ISO 8601, en UTC
}

interface JoinConversationPayload {
  conversationId: string;
}

@WebSocketGateway()
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

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
    @ConnectedSocket() client: Socket,
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
