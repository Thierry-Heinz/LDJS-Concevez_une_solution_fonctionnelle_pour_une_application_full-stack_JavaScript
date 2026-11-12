import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

const TEST_DATABASE_NAME = 'ycyw_test';

function databaseName(url: string) {
  return new URL(url).pathname.replace(/^\//, '');
}

/**
 * Variables d'environnement des tests e2e.
 *
 * La base de test est dérivée de DATABASE_URL (même serveur, base `ycyw_test`),
 * sauf si TEST_DATABASE_URL est fourni. Lève une erreur si la base visée
 * pourrait être celle de développement.
 */
export function loadTestEnv(): Record<string, string> {
  const devEnv = parse(readFileSync(resolve(__dirname, '../../.env')));
  const devUrl = devEnv.DATABASE_URL;
  if (!devUrl) {
    throw new Error('DATABASE_URL absent de server/.env');
  }

  let testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    const url = new URL(devUrl);
    url.pathname = `/${TEST_DATABASE_NAME}`;
    testUrl = url.toString();
  }

  const testName = databaseName(testUrl);
  if (!testName.endsWith('_test') || testName === databaseName(devUrl)) {
    throw new Error(
      `Base de test refusée : "${testName}" doit se terminer par _test et différer de la base de développement`,
    );
  }

  return {
    NODE_ENV: 'test',
    DATABASE_URL: testUrl,
    // Volontairement différente de la valeur de développement, pour vérifier
    // que l'origine vient bien de la configuration.
    CLIENT_ORIGIN: 'http://client.test',
    JWT_ACCESS_SECRET: 'e2e-secret-acces',
    JWT_REFRESH_SECRET: 'e2e-secret-rafraichissement',
    JWT_GUEST_SECRET: 'e2e-secret-invite',
    ACCESS_TOKEN_TTL_SECONDS: '900',
    REFRESH_TOKEN_IDLE_TTL_SECONDS: '3600',
    SESSION_ABSOLUTE_TTL_SECONDS: '10800',
    GUEST_TOKEN_TTL_SECONDS: '259200',
  };
}
