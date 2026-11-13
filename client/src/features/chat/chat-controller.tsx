import type { ChatMessage } from '../../types/chat-events';

export interface ChatController {
  title: string;
  messages: ChatMessage[];
  isLoading: boolean;
  hasConversation: boolean;
  closed: boolean;
  isSending: boolean;
  draft: string;
  setDraft: (value: string) => void;
  send: (content: string) => void;
  end: () => void;
  /** Absent côté agent : il ne crée pas de conversation. */
  restart?: () => void;
}
