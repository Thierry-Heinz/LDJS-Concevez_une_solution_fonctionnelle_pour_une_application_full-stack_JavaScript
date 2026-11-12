import { loadTestEnv } from './test-env';

// Exécuté avant chaque fichier de test, donc avant l'import d'AppModule :
// ConfigModule donne la priorité à process.env sur le fichier .env.
Object.assign(process.env, loadTestEnv());
