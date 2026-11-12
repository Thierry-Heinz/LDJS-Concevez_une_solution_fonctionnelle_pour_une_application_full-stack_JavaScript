import { AccountsModule } from '../src/accounts/accounts.module';
import { AccountsRepository } from '../src/accounts/accounts.repository';
import { AccountsService } from '../src/accounts/accounts.service';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import request from 'supertest';
import { createTestApp, type TestApp } from './setup/app';

// Sans strict, get() cherche dans toute l'application et renvoie la première
// instance trouvée, pas forcément celle du module sélectionné.
const STRICT = { strict: true };

describe('Application (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('injection de dépendances', () => {
    it('partage une seule instance de PrismaService', () => {
      const repository = t.app
        .select(AccountsModule)
        .get(AccountsRepository, STRICT);

      expect(repository['prisma']).toBe(
        t.app.select(PrismaModule).get(PrismaService, STRICT),
      );
    });

    it('partage une seule instance d’AccountsService', () => {
      const authService = t.app.select(AuthModule).get(AuthService, STRICT);

      expect(authService['accountsService']).toBe(
        t.app.select(AccountsModule).get(AccountsService, STRICT),
      );
    });
  });

  describe('configuration HTTP', () => {
    it('répond sur GET /api sans authentification', async () => {
      await request(t.server).get('/api').expect(200, 'Hello World!');
    });

    it('ne révèle pas le framework dans l’en-tête x-powered-by', async () => {
      const response = await request(t.server).get('/api/agencies').expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('sert le document OpenAPI sur /api/docs-json', async () => {
      const response = await request(t.server)
        .get('/api/docs-json')
        .expect(200);

      const paths = (response.body as { paths: Record<string, unknown> }).paths;
      expect(Object.keys(paths)).toEqual(
        expect.arrayContaining([
          '/api/auth/register',
          '/api/conversations',
          '/api/agencies',
        ]),
      );
    });

    it('décrit chaque réponse JSON objet par un schéma nommé', async () => {
      const response = await request(t.server)
        .get('/api/docs-json')
        .expect(200);

      type Schema = { $ref?: string; type?: string; items?: Schema };
      type Doc = {
        paths: Record<
          string,
          Record<
            string,
            {
              responses: Record<
                string,
                { content?: Record<string, { schema: Schema }> }
              >;
            }
          >
        >;
      };
      const { paths } = response.body as Doc;
      const inline: string[] = [];
      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, { responses }] of Object.entries(methods)) {
          for (const [status, { content }] of Object.entries(responses)) {
            const schema = content?.['application/json']?.schema;
            const isObject = schema && schema.type !== 'string'; // GET /api renvoie du texte
            if (isObject && !(schema.$ref ?? schema.items?.$ref)) {
              inline.push(`${method} ${path} ${status}`);
            }
          }
        }
      }
      expect(inline).toEqual([]);
    });
  });

  describe('CORS', () => {
    const CLIENT_ORIGIN = 'http://client.test'; // voir test/setup/test-env.ts

    it('autorise l’origine du front, cookies compris, sur l’API HTTP', async () => {
      const response = await request(t.server)
        .get('/api/agencies')
        .set('Origin', CLIENT_ORIGIN)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(
        CLIENT_ORIGIN,
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('n’autorise pas une autre origine', async () => {
      const response = await request(t.server)
        .get('/api/agencies')
        .set('Origin', 'http://malveillant.test');

      expect(response.headers['access-control-allow-origin']).not.toBe(
        'http://malveillant.test',
      );
    });

    it('autorise l’origine du front sur le handshake Socket.IO', async () => {
      const response = await request(t.server)
        .get('/socket.io/?EIO=4&transport=polling')
        .set('Origin', CLIENT_ORIGIN)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(
        CLIENT_ORIGIN,
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });
});
