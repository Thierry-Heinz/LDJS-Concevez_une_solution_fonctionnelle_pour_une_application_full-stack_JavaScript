import { useState } from 'react';
import { toast } from 'sonner';
import type { ChatController } from '@/features/chat/chat-controller';
import {
  useConversationMessages,
  useSendMessage,
} from '@/features/chat/use-conversation';
import { closeConversation } from '@/lib/socket';
import type { Conversation } from '@/types/api';

export function useAgentChat(conversation: Conversation): ChatController {
  const [draft, setDraft] = useState('');
  const messages = useConversationMessages(conversation.id); // rejoint la room + charge l'historique
  const sendMessage = useSendMessage();

  const firstName = messages.data?.find((m) => m.senderUser?.customer)
    ?.senderUser?.customer?.firstName;
  const title = firstName ?? (conversation.customerId ? 'Client' : 'Invité');

  async function send(content: string) {
    try {
      await sendMessage.mutateAsync({
        conversationId: conversation.id,
        content,
      });
    } catch {
      toast.error("Le message n'a pas pu être envoyé. Réessayez.");
      setDraft(content);
    }
  }

  async function end() {
    try {
      await closeConversation(conversation.id); // conversation:closed rafraîchira la liste
    } catch {
      toast.error("La conversation n'a pas pu être terminée. Réessayez.");
    }
  }

  return {
    title,
    messages: messages.data ?? [],
    isLoading: messages.isPending,
    hasConversation: true,
    closed: conversation.status === 'CLOSED',
    isSending: sendMessage.isPending,
    draft,
    setDraft,
    send: (content) => void send(content),
    end: () => void end(),
  };
}
