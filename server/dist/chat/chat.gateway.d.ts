import { Server, Socket } from 'socket.io';
interface SendMessagePayload {
    content: string;
}
export declare class ChatGateway {
    server: Server;
    handleSendMessage(payload: SendMessagePayload, client: Socket): {
        status: 'ok';
        id: string;
    };
}
export {};
