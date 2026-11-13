import { http, HttpResponse } from 'msw';
import { agency } from '@/test/fixtures';

/** Réponses communes à toutes les pages : la liste des agences (accueil, widget de chat). */
export const commonHandlers = [
  http.get('/api/agencies', () => HttpResponse.json([agency])),
];

/** Simule le cookie indicateur posé par le back à la connexion (jsdom n'applique pas les Set-Cookie simulés). */
export function setSessionHint() {
  document.cookie = 'has_session=1; path=/';
}
