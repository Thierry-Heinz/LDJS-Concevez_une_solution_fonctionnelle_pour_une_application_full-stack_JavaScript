// Alias courts sur les schémas du document OpenAPI (src/types/openapi.d.ts).
// Le suffixe _Output vient de nestjs-zod : il désigne la forme renvoyée par l'API.
// Après une modification des DTO du serveur : npm run gen:api
import type { components } from './openapi';

type Schemas = components['schemas'];

// ─── Corps de requête ────────────────────────────────────────────
export type RegisterInput = Schemas['RegisterDto'];
export type LoginInput = Schemas['LoginDto'];
export type StartConversationInput = Schemas['StartConversationDto'];

// ─── Réponses ────────────────────────────────────────────────────
export type Agency = Schemas['AgencyDto_Output'];
export type UserProfile = Schemas['UserProfileDto_Output'];
export type SessionUser = Schemas['SessionUserDto_Output'];
export type RefreshedUser = Schemas['RefreshedUserDto_Output'];
export type Conversation = Schemas['ConversationDto_Output'];
export type ChatMessage = Schemas['MessageDto_Output'];
/** Corps d'une réponse d'erreur (à ne pas confondre avec la classe ApiError de @/lib/api). */
export type ApiErrorBody = Schemas['ApiErrorDto_Output'];

// ─── Types dérivés ───────────────────────────────────────────────
export type Role = UserProfile['role'];
export type ConversationOrigin = Conversation['origin'];
export type ConversationStatus = Conversation['status'];
