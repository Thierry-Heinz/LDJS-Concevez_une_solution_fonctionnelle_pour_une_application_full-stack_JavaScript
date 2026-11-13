import { useEffect, useSyncExternalStore } from 'react';
import { socket } from '../../lib/socket';
import type { ChatMessage } from '../../types/chat-events';
import { useQueryClient } from '@tanstack/react-query';
import {
  conversationsKey,
  currentConversationQuery,
  messagesQuery,
  openConversationsQuery,
} from '../../lib/queries/conversations';

function subscribeToConnection(onChange: () => void) {
  socket.on('connect', onChange);
  socket.on('disconnect', onChange);
  return () => {
    socket.off('connect', onChange);
    socket.off('disconnect', onChange);
  };
}

/** Indique si le socket est connecté, via `useSyncExternalStore` car cet état vit hors de React. */
export function useSocketConnected() {
  return useSyncExternalStore(subscribeToConnection, () => socket.connected);
}

function upsert(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const messageExists = list.some((el) => el.id === message.id);
  if (messageExists) {
    return list.map((el) => (el.id === message.id ? message : el));
  }
  return [...list, message];
}

/**
 * Répercute les événements Socket.IO dans le cache TanStack Query ; à appeler une seule fois, dans le layout racine.
 * `conversation:closed` passe la conversation à `CLOSED` dans le cache sans nouvelle requête.
 * Après une reconnexion, toutes les conversations sont invalidées pour récupérer les messages manqués.
 */
export function useChatCacheSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onMessage = (message: ChatMessage) => {
      const messageKey = messagesQuery(message.conversationId).queryKey;
      queryClient.setQueryData(messageKey, (previous) =>
        upsert(previous ?? [], message),
      );
    };

    const onClosed = ({ conversationId }: { conversationId: string }) => {
      queryClient.setQueryData(currentConversationQuery.queryKey, (previous) =>
        previous?.id === conversationId
          ? { ...previous, status: 'CLOSED' as const }
          : previous,
      );
      void queryClient.invalidateQueries({
        queryKey: openConversationsQuery.queryKey,
      });
    };

    const onReconnect = () =>
      void queryClient.invalidateQueries({ queryKey: conversationsKey });

    socket.on('message:new', onMessage);
    socket.on('conversation:closed', onClosed);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('conversation:closed', onClosed);
      socket.io.off('reconnect', onReconnect);
    };
  }, [queryClient]);
}
