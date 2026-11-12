import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Adapter Socket.IO qui applique l'origine CORS autorisée (`CLIENT_ORIGIN`).
 * Il est nécessaire parce que les options de `@WebSocketGateway` sont lues à
 * l'import, avant le chargement de la configuration.
 */
export class ChatIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly clientOrigin: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.clientOrigin, credentials: true },
    }) as Server;
  }
}
