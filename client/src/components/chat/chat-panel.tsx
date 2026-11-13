// Le contenu d'une conversation : en-tête, bandeau hors ligne, messages, saisie.
// Utilisé tel quel dans le popover (desktop), la feuille (mobile) et la page agent.

import { useId, type FormEvent, type ReactNode } from 'react';
import { LoaderCircle, Send, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageList } from '@/components/chat/message-list';
import type { ChatController } from '@/features/chat/chat-controller';
import { useSocketConnected } from '../../features/chat/use-chat-sync';

interface ChatPanelProps {
  chat: ChatController;
  viewer: 'client' | 'agent';
  titleNode: ReactNode;
  headerAction?: ReactNode;
  footerNote?: ReactNode;
}

export function ChatPanel({
  chat,
  viewer,
  titleNode,
  headerAction,
  footerNote,
}: ChatPanelProps) {
  const inputId = useId();
  const connected = useSocketConnected();

  // Sans conversation, le socket n'est pas encore ouvert : ce n'est pas une panne
  const offline = chat.hasConversation && !chat.closed && !connected;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = chat.draft.trim();
    if (!content || chat.isSending) return;
    chat.send(content);
    chat.setDraft('');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b">
        <div className="flex min-h-11 items-center justify-between gap-2 pt-1.5 pr-1.5 pl-4">
          {titleNode}
          {headerAction}
        </div>
        <div className="flex min-h-11 items-center justify-between gap-2 pr-1.5 pb-1.5 pl-4 text-[13px] text-muted-foreground">
          <span>
            {chat.closed
              ? 'Conversation terminée'
              : chat.hasConversation
                ? 'En cours'
                : null}
          </span>
          {chat.hasConversation && !chat.closed && (
            <Button
              variant="ghost"
              onClick={chat.end}
              className="h-11 px-2.5 text-[13px] text-destructive"
            >
              Terminer la conversation
            </Button>
          )}
        </div>
      </header>

      {offline && (
        <p
          role="status"
          className="flex items-center gap-2 border-b border-warning bg-warning-soft px-4 py-2 text-[13px] font-semibold text-warning-text"
        >
          <WifiOff className="size-4" aria-hidden="true" />
          Connexion perdue. Reconnexion en cours…
        </p>
      )}

      <MessageList
        messages={chat.messages}
        viewer={viewer}
        isLoading={chat.isLoading}
        closed={chat.closed}
      />

      <footer className="flex flex-col gap-2 border-t px-4 pt-3 pb-4">
        {chat.closed ? (
          <>
            <p role="status" className="text-[13px] text-muted-foreground">
              Cette conversation est terminée. Vous ne pouvez plus y écrire.
            </p>
            {chat.restart && (
              <Button onClick={chat.restart} className="h-11 w-full">
                Nouvelle conversation
              </Button>
            )}
          </>
        ) : (
          <>
            {footerNote}
            {/* Un vrai <form> : la touche Entrée envoie le message, sans code supplémentaire */}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={inputId} className="text-xs">
                  Votre message
                </Label>
                <Input
                  id={inputId}
                  value={chat.draft}
                  onChange={(event) => chat.setDraft(event.target.value)}
                  placeholder="Écrivez votre message"
                  autoComplete="off"
                  maxLength={2000}
                  disabled={offline}
                  className="h-11 text-base"
                />
              </div>
              {/* Bouton icône : libellé accessible obligatoire, cible de 44 × 44 px */}
              <Button
                type="submit"
                size="icon"
                aria-label="Envoyer"
                disabled={offline || chat.isSending}
                className="size-11"
              >
                {chat.isSending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send aria-hidden="true" />
                )}
              </Button>
            </form>
          </>
        )}
      </footer>
    </div>
  );
}
