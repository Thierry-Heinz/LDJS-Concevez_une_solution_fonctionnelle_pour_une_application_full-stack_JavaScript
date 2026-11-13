// ─── 1. L'état de la connexion ───────────────────────────────────

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

/** true quand le socket est connecté. useSyncExternalStore : lire un état qui vit hors de React. */
export function useSocketConnected() {
  return useSyncExternalStore(subscribeToConnection, () => socket.connected);
}

// ─── 2. Socket → cache (à appeler UNE fois, dans le layout racine) ─

function upsert(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const messageExists = list.some((el) => el.id === message.id);
  if (messageExists) {
    return list.map((el) => (el.id === message.id ? message : el));
  }
  return [...list, message];
}

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
      // La conversation du client passe à CLOSED dans le cache, sans refaire de requête
      queryClient.setQueryData(currentConversationQuery.queryKey, (previous) =>
        previous?.id === conversationId
          ? { ...previous, status: 'CLOSED' as const }
          : previous,
      );
      void queryClient.invalidateQueries({
        queryKey: openConversationsQuery.queryKey,
      });
    };

    // Après une coupure, des messages ont pu être manqués : on recharge tout ce qui concerne les conversations
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
