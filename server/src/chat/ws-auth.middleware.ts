import { parseCookie } from 'cookie';
import { AuthService } from '../auth/auth.service';
import { ChatSocket } from './chat.types';

/**
 * Authentifie chaque connexion Socket.IO au handshake, à partir des cookies,
 * et place l'identité dans `socket.data.identity`. Refuse la connexion
 * (`UNAUTHENTICATED`) si l'appelant est anonyme ou si un jeton est invalide.
 */
export function createWsAuthMiddleware(authService: AuthService) {
  return (socket: ChatSocket, next: (err?: Error) => void): void => {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');

    authService
      .resolveIdentity(cookies)
      .then((identity) => {
        if (identity.kind === 'anonymous') {
          return next(new Error('UNAUTHENTICATED'));
        }
        socket.data.identity = identity;
        next();
      })
      .catch(() => next(new Error('UNAUTHENTICATED')));
  };
}
