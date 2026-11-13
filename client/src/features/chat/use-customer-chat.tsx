import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { toast } from 'sonner';

import { agenciesQuery } from '@/lib/queries/agencies';
import { meQuery } from '@/lib/queries/auth';
import {
  currentConversationQuery,
  useStartConversation,
} from '@/lib/queries/conversations';
import { closeConversation, joinConversation, socket } from '@/lib/socket';
import type { Agency, Conversation } from '@/types/api';
import type { ChatController } from './chat-controller';
import { useConversationMessages, useSendMessage } from './use-conversation';

function chatTitle(
  conversation: Conversation | null | undefined,
  pageAgency: Agency | undefined,
  agencies: Agency[] = [],
) {
  if (conversation) {
    if (conversation.origin === 'GENERAL') return 'Service client';
    return (
      agencies.find((a) => a.id === conversation.agencyId)?.name ?? 'Agence'
    );
  }
  return pageAgency?.name ?? 'Service client';
}

/**
 * Chat du client ou du visiteur ; rien n'est chargé tant que `enabled` est faux (RGESN).
 * Au premier message, la conversation est créée et la room rejointe avant l'envoi.
 * La clôture est répercutée dans le cache par l'événement `conversation:closed`.
 */
export function useCustomerChat(
  enabled: boolean,
): ChatController & { isGuest: boolean } {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const { agenceId } = useParams({ strict: false });
  const { data: agencies } = useQuery(agenciesQuery);
  const pageAgency = agencies?.find((a) => a.id === agenceId);

  const { data: me } = useQuery(meQuery);
  const { data: conversation } = useQuery({
    ...currentConversationQuery,
    enabled,
  });
  const messages = useConversationMessages(conversation?.id);

  const startConversation = useStartConversation();
  const sendMessage = useSendMessage();

  async function send(content: string) {
    try {
      let conversationId = conversation?.id;

      if (!conversationId) {
        const created = await startConversation.mutateAsync({
          agencyId: pageAgency?.id,
          asGuest: !me,
        });
        conversationId = created.id;
        if (!socket.connected) socket.connect();
        await joinConversation(conversationId);
      }

      await sendMessage.mutateAsync({ conversationId, content });
    } catch {
      toast.error("Le message n'a pas pu être envoyé. Réessayez.");
      setDraft(content);
    }
  }

  async function end() {
    if (!conversation) return;
    try {
      await closeConversation(conversation.id);
    } catch {
      toast.error("La conversation n'a pas pu être terminée. Réessayez.");
    }
  }

  return {
    title: chatTitle(conversation, pageAgency, agencies),
    messages: messages.data ?? [],
    isLoading: Boolean(conversation) && messages.isPending,
    hasConversation: Boolean(conversation),
    closed: conversation?.status === 'CLOSED',
    isSending: startConversation.isPending || sendMessage.isPending,
    draft,
    setDraft,
    send: (content) => void send(content),
    end: () => void end(),
    restart: () =>
      queryClient.setQueryData(currentConversationQuery.queryKey, null),
    isGuest: !me,
  };
}
