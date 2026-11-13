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

/** Historique d'une conversation, une entrée de cache par conversation ; jamais périmé, car le socket le tient ensuite à jour. */
export const messagesQuery = (conversationId: string) =>
  queryOptions({
    queryKey: [...conversationsKey, conversationId, 'messages'],
    queryFn: () =>
      api.get<ChatMessage[]>(`/conversations/${conversationId}/messages`),
    staleTime: Infinity,
  });

interface StartConversationVariables {
  /** Fourni sur la page d'une agence : la conversation s'adresse à elle. Sinon : service client. */
  agencyId?: string;
  /** Visiteur sans compte : il faut d'abord obtenir un cookie invité. */
  asGuest: boolean;
}

/**
 * Démarre une conversation, après avoir obtenu un cookie invité si nécessaire (appel idempotent côté back).
 * La réponse est écrite directement comme conversation en cours, sans nouveau GET.
 * Un 409 signale une conversation déjà ouverte vers une autre cible : celle-ci est alors rechargée.
 */
export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agencyId, asGuest }: StartConversationVariables) => {
      if (asGuest) await api.post<void>('/auth/guest');
      return api.post<Conversation>(
        '/conversations',
        agencyId ? { origin: 'AGENCY', agencyId } : { origin: 'GENERAL' },
      );
    },

    onSuccess: (conversation) => {
      queryClient.setQueryData(currentConversationQuery.queryKey, conversation);
      reconnectSocket();
    },

    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: currentConversationQuery.queryKey,
        });
      }
    },
  });
}
