import { Server, Socket } from 'socket.io';
interface SendMessagePayload {
    content: string;
}
interface JoinConversationPayload {
    conversationId: string;
}
export declare class ChatGateway {
    server: Server;
    handleSendMessage(payload: SendMessagePayload, client: Socket): {
        status: 'ok';
        id: string;
    };
    handleJoinConversation(payload: JoinConversationPayload, client: Socket): Promise<{
        status: 'ok';
        conversationId: string;
    }>;
}
export {};
