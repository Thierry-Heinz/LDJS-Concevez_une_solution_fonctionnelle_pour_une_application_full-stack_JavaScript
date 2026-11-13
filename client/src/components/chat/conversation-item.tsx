import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Conversation } from '@/types/api';
import { cn } from 'cn';

const dateTime = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

interface ConversationItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}

/**
 * Élément de la sidebar agent, construit uniquement à partir de `GET /conversations/open`, sans requête supplémentaire.
 * La sélection est exposée par `aria-current` pour les lecteurs d'écran, et pas seulement par la couleur.
 */
export function ConversationItem({
  conversation,
  selected,
  onSelect,
}: ConversationItemProps) {
  const who = conversation.customerId ? 'Client' : 'Invité';
  const origin = conversation.origin === 'AGENCY' ? 'Agence' : 'Service client';

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-3 border-b px-4 py-3.5 text-left hover:bg-muted',
          selected && 'bg-secondary shadow-[inset_3px_0_0_var(--primary)]',
        )}
      >
        <Avatar className="size-10" aria-hidden="true">
          <AvatarFallback className="bg-secondary text-sm font-semibold">
            {who.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold">{who}</span>
          <span className="text-[13px] text-muted-foreground">{origin}</span>
          <span className="text-xs text-muted-foreground">
            Ouverte le{' '}
            <time dateTime={conversation.openedAt}>
              {dateTime.format(new Date(conversation.openedAt))}
            </time>
          </span>
        </span>
      </button>
    </li>
  );
}
