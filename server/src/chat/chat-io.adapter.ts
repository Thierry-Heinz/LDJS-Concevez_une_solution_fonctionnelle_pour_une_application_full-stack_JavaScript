import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

// Les options de @WebSocketGateway sont figées à l'import du fichier, avant le
// chargement de la configuration : l'origine autorisée est donc injectée ici,
// à la création du serveur Socket.IO.
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
