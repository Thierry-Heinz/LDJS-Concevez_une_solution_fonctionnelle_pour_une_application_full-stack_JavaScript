import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().disable('x-powered-by');

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
