import { setupServer } from 'msw/node';

/** Serveur MSW partagé, sans handler par défaut : chaque test déclare les réponses qu'il attend avec `server.use(...)`. */
export const server = setupServer();
