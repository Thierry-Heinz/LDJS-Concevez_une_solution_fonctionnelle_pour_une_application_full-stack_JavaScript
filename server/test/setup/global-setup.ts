import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadTestEnv } from './test-env';

function run(command: string, env: NodeJS.ProcessEnv) {
  try {
    execSync(command, {
      cwd: resolve(__dirname, '../..'),
      env,
      stdio: 'pipe',
    });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `Échec de "${command}" :\n${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`,
    );
  }
}

// Une fois avant toute la suite : crée la base de test si besoin,
// applique les migrations et charge les données de référence.
export default function globalSetup() {
  const env = { ...process.env, ...loadTestEnv() };
  run('npx prisma migrate deploy', env);
  run('npx prisma db seed', env);
}
