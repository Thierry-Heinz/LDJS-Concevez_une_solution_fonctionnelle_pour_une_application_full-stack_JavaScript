/**
 * @file Types de l'API HTTP : alias courts des schémas générés depuis le Swagger (`npm run gen:api`).
 * Les types du temps réel sont dans `chat-events.ts`.
 */
import type { components } from './openapi';
import type { ChatMessage } from './chat-events';

type Schemas = components['schemas'];

export type LoginInput = Schemas['LoginDto'];
export type RegisterInput = Schemas['RegisterDto'];
export type StartConversationInput = Schemas['StartConversationDto'];

export type Agency = Schemas['AgencyDto_Output'];
export type UserProfile = Schemas['UserProfileDto_Output'];
export type SessionUser = Schemas['SessionUserDto_Output'];
export type RefreshedUser = Schemas['RefreshedUserDto_Output'];
export type Conversation = Schemas['ConversationDto_Output'];

/** Corps d'une réponse d'erreur. Ne pas confondre avec la classe ApiError de lib/api.ts. */
export type ApiErrorBody = Schemas['ApiErrorDto_Output'];

export type Role = UserProfile['role'];
export type ConversationOrigin = Conversation['origin'];
export type ConversationStatus = Conversation['status'];

/**
 * Garde-fou : un message reçu par HTTP (historique) ou par le socket (`message:new`) est rangé dans la même liste du cache.
 * Le front utilise `ChatMessage` partout ; `_sameMessageShape` échoue à la compilation si les deux formes divergent.
 */
type HttpMessage = Schemas['MessageDto_Output'];
const _sameMessageShape: [HttpMessage, ChatMessage] extends [
  ChatMessage,
  HttpMessage,
]
  ? true
  : never = true;
void _sameMessageShape;
