import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ChatIoAdapter } from './chat/chat-io.adapter';

/**
 * Configuration commune à `main.ts` et aux tests e2e : préfixe `/api`,
 * lecture des cookies, en-tête `x-powered-by` masqué, CORS HTTP et WebSocket
 * limités à `CLIENT_ORIGIN`.
 */
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Même origine pour l'API HTTP et le WebSocket : celle du front
  const clientOrigin = app
    .get(ConfigService)
    .getOrThrow<string>('CLIENT_ORIGIN');
  app.enableCors({ origin: clientOrigin, credentials: true });
  app.useWebSocketAdapter(new ChatIoAdapter(app, clientOrigin));
}

/**
 * Génère la documentation OpenAPI et la sert sur `/api/docs` (interface)
 * et `/api/docs-json` (document brut).
 */
export function setupSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('Your Car Your Way — API PoC')
    .setDescription(
      'API HTTP du PoC de chat. Le temps réel (Socket.IO) est décrit dans src/chat/chat.events.ts.',
    )
    .setVersion('0.1')
    .addCookieAuth(
      'access_token',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          "Jeton d'accès (JWT) déposé à la connexion d'un client ou d'un agent",
      },
      'access_token',
    )
    .addCookieAuth(
      'refresh_token',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'Jeton de rafraîchissement, envoyé uniquement sur /api/auth/refresh',
      },
      'refresh_token',
    )
    .addCookieAuth(
      'guest_token',
      {
        type: 'apiKey',
        in: 'cookie',
        description: 'Jeton invité déposé par POST /api/auth/guest',
      },
      'guest_token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document));
}
