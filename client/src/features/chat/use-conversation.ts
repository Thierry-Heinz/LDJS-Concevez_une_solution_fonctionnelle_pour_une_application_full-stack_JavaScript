import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  currentConversationQuery,
  messagesQuery,
} from '@/lib/queries/conversations';
import { joinConversation, sendMessage, socket } from '@/lib/socket';

/**
 * Charge l'historique d'une conversation et rejoint sa room Socket.IO, puis à nouveau après chaque reconnexion.
 * Si le serveur refuse l'accès (conversation fermée, droits insuffisants), la conversation en cours est rechargée.
 */
export function useConversationMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const join = () => {
      void joinConversation(conversationId).catch(() => {
        void queryClient.invalidateQueries({
          queryKey: currentConversationQuery.queryKey,
        });
      });
    };

    if (socket.connected) join();
    else socket.connect();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
    };
  }, [conversationId, queryClient]);

  return useQuery({
    ...messagesQuery(conversationId ?? ''),
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: (variables: { conversationId: string; content: string }) =>
      sendMessage(variables),
  });
}
