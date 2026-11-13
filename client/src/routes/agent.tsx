import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatPanel } from '@/components/chat/chat-panel';
import { ConversationItem } from '@/components/chat/conversation-item';
import { useAgentChat } from '@/features/chat/use-agent-chat';
import { meQuery } from '@/lib/queries/auth';
import { openConversationsQuery } from '@/lib/queries/conversations';
import type { Conversation } from '@/types/api';
import { cn } from 'cn';

/**
 * Tableau de bord de l'agent : conversations ouvertes de son agence et conversation sélectionnée (`?c=`).
 * `beforeLoad` redirige avant tout rendu les visiteurs et les non-agents ; la vraie sécurité reste côté back.
 */
export const Route = createFileRoute('/agent')({
  validateSearch: z.object({ c: z.string().optional() }),

  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me)
      throw redirect({ to: '/connexion', search: { redirect: location.href } });
    if (me.role !== 'AGENT') throw redirect({ to: '/' });
  },

  loader: ({ context }) =>
    context.queryClient.ensureQueryData(openConversationsQuery),
  component: AgentPage,
});

/**
 * La liste est rechargée toutes les 10 secondes pour faire apparaître les nouvelles demandes.
 * La `key` de `AgentConversation` recrée le composant à chaque changement de conversation, ce qui réinitialise le brouillon.
 */
function AgentPage() {
  const { c: selectedId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: conversations = [] } = useQuery({
    ...openConversationsQuery,
    refetchInterval: 10_000,
  });
  const selected = conversations.find((c) => c.id === selectedId);

  const select = (id?: string) => void navigate({ search: { c: id } });

  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label="Conversations ouvertes"
        className={cn(
          'min-h-0 w-full flex-col md:flex md:w-[320px] md:flex-none md:border-r',
          selected ? 'hidden' : 'flex',
        )}
      >
        <h1 className="border-b p-4 text-sm font-extrabold">
          Conversations ouvertes ({conversations.length})
        </h1>
        {conversations.length === 0 ? (
          <EmptyState title="Aucune conversation ouverte">
            Les nouvelles demandes de votre agence apparaîtront ici.
          </EmptyState>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <ul>
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === selectedId}
                  onSelect={() => select(conversation.id)}
                />
              ))}
            </ul>
          </ScrollArea>
        )}
      </nav>

      <section
        aria-label="Conversation"
        className={cn(
          'min-h-0 min-w-0 flex-1 flex-col md:flex',
          selected ? 'flex' : 'hidden',
        )}
      >
        {selected ? (
          <AgentConversation
            key={selected.id}
            conversation={selected}
            onBack={() => select(undefined)}
          />
        ) : (
          <EmptyState title="Aucune conversation sélectionnée">
            Choisissez une conversation dans la liste pour y répondre.
          </EmptyState>
        )}
      </section>
    </div>
  );
}

function AgentConversation({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const chat = useAgentChat(conversation);

  return (
    <ChatPanel
      chat={chat}
      viewer="agent"
      titleNode={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Retour à la liste des conversations"
            onClick={onBack}
            className="-ml-3 size-11 md:hidden"
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <h2 className="text-base font-extrabold">{chat.title}</h2>
        </div>
      }
    />
  );
}

function EmptyState({ title, children }: { title: string; children: string }) {
  return (
    <div className="m-auto flex max-w-64 flex-col items-center gap-2.5 p-6 text-center text-sm text-muted-foreground">
      <MessageSquare className="size-6 text-primary" aria-hidden="true" />
      <strong className="text-base text-foreground">{title}</strong>
      {children}
    </div>
  );
}
