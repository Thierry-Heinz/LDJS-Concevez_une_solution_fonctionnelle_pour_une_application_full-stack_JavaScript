import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  currentConversationQuery,
  messagesQuery,
} from '@/lib/queries/conversations';
import { joinConversation, sendMessage, socket } from '@/lib/socket';

export function useConversationMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const join = () => {
      void joinConversation(conversationId).catch(() => {
        // Join refusé (conversation fermée, accès refusé…) : on recharge la conversation en cours
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

// ─── 4. Envoi ────────────────────────────────────────────────────

export function useSendMessage() {
  return useMutation({
    mutationFn: (variables: { conversationId: string; content: string }) =>
      sendMessage(variables),
  });
}
