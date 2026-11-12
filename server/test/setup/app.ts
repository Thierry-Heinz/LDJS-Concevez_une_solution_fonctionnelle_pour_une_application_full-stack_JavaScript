import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../../src/app.module';
import { configureApp, setupSwagger } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '../../src/generated/prisma/enums';

// Identifiants et mot de passe créés par prisma/seed.ts
export const AGENCY_IDS = {
  central: '7d352956-ec5d-43a5-9ef3-612481435498',
  paris: 'f2e84b9f-ae2f-427d-a9f7-dc4155ed54fd',
  lyon: 'c86e2ac9-03fc-4fc4-b64d-9a298d25e3d5',
} as const;
export const AGENTS = {
  central: 'central@ycyw.test',
  paris: 'paris@ycyw.test',
  lyon: 'lyon@ycyw.test',
} as const;
export const AGENT_PASSWORD = 'un_mot_de_passe_long';

export const CUSTOMER = {
  email: 'jean.dupont@example.com',
  password: 'mot_de_passe_client_123',
  firstName: 'Jean',
  lastName: 'Dupont',
  birthDate: '1990-05-12',
  address: '12 rue de la République, 69002 Lyon',
};

export type TestApp = {
  app: NestExpressApplication;
  server: App;
  prisma: PrismaService;
  url: string;
};

/** Démarre l'application avec la configuration de main.ts, sur un port libre. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const databaseUrl = moduleRef.get(ConfigService).get<string>('DATABASE_URL');
  if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
    throw new Error('Les tests e2e doivent viser la base de test');
  }

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  configureApp(app);
  setupSwagger(app);
  await app.listen(0, '127.0.0.1');

  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    server: app.getHttpServer() as App,
    prisma: app.get(PrismaService),
    url: `http://127.0.0.1:${port}`,
  };
}

/** Supprime les données créées par les tests, en gardant celles du seed. */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany({ where: { role: Role.CUSTOMER } });
}

/** Extrait la valeur d'un cookie des en-têtes Set-Cookie d'une réponse. */
export function getCookie(response: request.Response, name: string) {
  const header = response.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  return cookie?.split(';')[0].slice(name.length + 1);
}

/** Renvoie l'en-tête Set-Cookie complet d'un cookie (attributs compris). */
export function getSetCookie(response: request.Response, name: string) {
  const header = response.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

export async function login(server: App, email: string, password: string) {
  const response = await request(server)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return {
    response,
    accessToken: getCookie(response, 'access_token')!,
    refreshToken: getCookie(response, 'refresh_token')!,
  };
}

export async function registerAndLoginCustomer(server: App) {
  await request(server).post('/api/auth/register').send(CUSTOMER).expect(201);
  return login(server, CUSTOMER.email, CUSTOMER.password);
}

export function loginAgent(server: App, agent: keyof typeof AGENTS) {
  return login(server, AGENTS[agent], AGENT_PASSWORD);
}

export async function createGuest(server: App) {
  const response = await request(server).post('/api/auth/guest').expect(204);
  return getCookie(response, 'guest_token')!;
}
