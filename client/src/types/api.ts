// Types de l'API HTTP : noms courts sur les schémas générés depuis le Swagger (npm run gen:api).
// Les types du temps réel sont dans chat-events.ts.
import type { components } from './openapi';
import type { ChatMessage } from './chat-events';

type Schemas = components['schemas'];

// ─── Corps des requêtes ───
export type LoginInput = Schemas['LoginDto'];
export type RegisterInput = Schemas['RegisterDto'];
export type StartConversationInput = Schemas['StartConversationDto'];

// ─── Réponses ───
export type Agency = Schemas['AgencyDto_Output'];
export type UserProfile = Schemas['UserProfileDto_Output'];
export type SessionUser = Schemas['SessionUserDto_Output'];
export type RefreshedUser = Schemas['RefreshedUserDto_Output'];
export type Conversation = Schemas['ConversationDto_Output'];

/** Corps d'une réponse d'erreur. Ne pas confondre avec la classe ApiError de lib/api.ts. */
export type ApiErrorBody = Schemas['ApiErrorDto_Output'];

// ─── Types dérivés : ils suivent automatiquement le back ───
export type Role = UserProfile['role'];
export type ConversationOrigin = Conversation['origin'];
export type ConversationStatus = Conversation['status'];

// ─── Garde-fou ───
// Un message arrive par HTTP (historique) ou par le socket (message:new), et les deux
// sont rangés dans la même liste du cache : ils doivent avoir exactement la même forme.
// Le front utilise ChatMessage partout ; cette ligne échoue à la compilation si les deux divergent.
type HttpMessage = Schemas['MessageDto_Output'];
const _sameMessageShape: [HttpMessage, ChatMessage] extends [
  ChatMessage,
  HttpMessage,
]
  ? true
  : never = true;
void _sameMessageShape;
