import { Fragment, useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { cva, type VariantProps } from 'class-variance-authority';
import { MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChatMessage } from '@/types/chat-events';
import { cn } from 'cn';

// ─── Bulle et message système (internes à la liste) ─────────────

// Les variantes n'utilisent que des tokens (bg-chat-me…), jamais de couleur en dur
const bubbleVariants = cva(
  'rounded-[14px] px-3.5 py-2.5 text-sm leading-5 break-words',
  {
    variants: {
      side: {
        me: 'rounded-br-sm bg-chat-me text-chat-me-foreground',
        other: 'rounded-bl-sm bg-chat-other text-chat-other-foreground',
      },
    },
    defaultVariants: { side: 'other' },
  },
);

const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

interface ChatBubbleProps extends VariantProps<typeof bubbleVariants> {
  sender: string;
  /** Date ISO du message. */
  sentAt: string;
  children: string;
}

function ChatBubble({
  side = 'other',
  sender,
  sentAt,
  children,
}: ChatBubbleProps) {
  return (
    <li
      className={cn(
        'flex max-w-[88%] flex-col gap-1',
        side === 'me' ? 'items-end self-end' : 'items-start self-start',
      )}
    >
      {/* RGAA : l'expéditeur et l'heure sont écrits ; la couleur et le côté ne sont qu'un renfort */}
      <span className="text-xs leading-4 text-muted-foreground">
        <b className="font-semibold text-foreground">{sender}</b> ·{' '}
        <time dateTime={sentAt}>{timeFormat.format(new Date(sentAt))}</time>
      </span>
      <p className={bubbleVariants({ side })}>{children}</p>
    </li>
  );
}

function SystemMessage({ children }: { children: string }) {
  return (
    <li className="self-center rounded-full bg-chat-system px-3 py-1 text-center text-xs leading-4 text-chat-system-foreground">
      {children}
    </li>
  );
}

function senderName(message: ChatMessage, isMine: boolean) {
  if (isMine) return 'Vous';
  if (message.senderType === 'AGENT')
    return message.senderAgency?.name ?? 'Conseiller';
  return message.senderUser?.customer?.firstName ?? 'Invité';
}

// ─── La liste ────────────────────────────────────────────────────

interface MessageListProps {
  messages: ChatMessage[];
  /** Qui regarde : décide de quel côté s'affichent les bulles. */
  viewer: 'client' | 'agent';
  isLoading?: boolean;
  closed?: boolean;
}

export function MessageList({
  messages,
  viewer,
  isLoading,
  closed,
}: MessageListProps) {
  // Défilement automatique vers le dernier message
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const firstAgentIndex = messages.findIndex((m) => m.senderType === 'AGENT');

  return (
    <ScrollArea className="min-h-0 flex-1">
      {/* role="log" + aria-live="polite" : chaque nouveau message est annoncé aux lecteurs d'écran.
          tabIndex={0} : la liste se fait défiler au clavier. */}
      <ul
        role="log"
        aria-live="polite"
        aria-label="Messages"
        tabIndex={0}
        className="flex min-h-full flex-col gap-3.5 p-4"
      >
        {isLoading && (
          <li aria-hidden="true" className="flex flex-col gap-3.5">
            <Skeleton className="h-11 w-3/5" />
            <Skeleton className="h-11 w-1/2 self-end" />
          </li>
        )}

        {!isLoading && messages.length === 0 && (
          <li className="m-auto flex max-w-64 flex-col items-center gap-2.5 text-center text-sm text-muted-foreground">
            <MessageCircle className="size-6 text-primary" aria-hidden="true" />
            <strong className="text-base text-foreground">
              Posez votre question
            </strong>
            Un conseiller vous répond.
          </li>
        )}

        {messages.length > 0 && viewer === 'client' && (
          <li className="px-2 text-center text-xs leading-[18px] text-muted-foreground">
            Vos messages sont conservés pour traiter votre demande.{' '}
            <Link to="/donnees-personnelles" className="text-primary underline">
              En savoir plus
            </Link>
          </li>
        )}

        {messages.map((message, index) => {
          const isMine =
            viewer === 'agent'
              ? message.senderType === 'AGENT'
              : message.senderType !== 'AGENT';
          return (
            <Fragment key={message.id}>
              {index === firstAgentIndex && (
                <SystemMessage>
                  {viewer === 'agent'
                    ? 'Vous avez rejoint la conversation'
                    : 'Un conseiller a rejoint la conversation'}
                </SystemMessage>
              )}
              <ChatBubble
                side={isMine ? 'me' : 'other'}
                sender={senderName(message, isMine)}
                sentAt={message.sentAt}
              >
                {message.content}
              </ChatBubble>
            </Fragment>
          );
        })}

        {closed && <SystemMessage>Conversation terminée</SystemMessage>}
        <div ref={endRef} />
      </ul>
    </ScrollArea>
  );
}
