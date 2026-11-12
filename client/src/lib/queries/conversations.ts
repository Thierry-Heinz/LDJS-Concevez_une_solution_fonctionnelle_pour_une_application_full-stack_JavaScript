import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { nullOn } from '@/lib/queries/utils';
import type { Conversation } from '@/types/api';
import type { ChatMessage } from '@/types/chat-events';
import { reconnectSocket } from '../socket';

/** Clé racine : retirer ou invalider tout ce qui concerne les conversations d'un coup. */
export const conversationsKey = ['conversations'] as const;

// ─── Requêtes ────────────────────────────────────────────────────

/** La conversation ouverte du client ou de l'invité, ou null s'il n'y en a pas. */
export const currentConversationQuery = queryOptions({
  queryKey: [...conversationsKey, 'current'],
  queryFn: () =>
    nullOn([401, 404], api.get<Conversation>('/conversations/current')),
  retry: false,
});

/** Les conversations ouvertes de l'agence de l'agent connecté. */
export const openConversationsQuery = queryOptions({
  queryKey: [...conversationsKey, 'open'],
  queryFn: () => api.get<Conversation[]>('/conversations/open'),
});

/** L'historique d'une conversation : une entrée de cache par conversation. */
export const messagesQuery = (conversationId: string) =>
  queryOptions({
    queryKey: [...conversationsKey, conversationId, 'messages'],
    queryFn: () =>
      api.get<ChatMessage[]>(`/conversations/${conversationId}/messages`),
    staleTime: Infinity, // ensuite, c'est le socket qui tiendra le cache à jour
  });

// ─── Mutations ───────────────────────────────────────────────────

interface StartConversationVariables {
  /** Fourni sur la page d'une agence : la conversation s'adresse à elle. Sinon : service client. */
  agencyId?: string;
  /** Visiteur sans compte : il faut d'abord obtenir un cookie invité. */
  asGuest: boolean;
}

export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agencyId, asGuest }: StartConversationVariables) => {
      if (asGuest) await api.post<void>('/auth/guest'); // idempotent côté back
      return api.post<Conversation>(
        '/conversations',
        agencyId ? { origin: 'AGENCY', agencyId } : { origin: 'GENERAL' },
      );
    },

    onSuccess: (conversation) => {
      // La réponse EST la conversation en cours : on l'écrit directement, sans refaire de GET
      queryClient.setQueryData(currentConversationQuery.queryKey, conversation);
      reconnectSocket();
    },

    onError: (error) => {
      // 409 : une conversation est déjà ouverte vers une autre cible → on recharge celle qui existe
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: currentConversationQuery.queryKey,
        });
      }
    },
  });
}
