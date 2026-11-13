// Le chat du client et du visiteur : bouton flottant + Popover (desktop) ou Sheet (mobile).
// Toute la logique est dans useClientChat : ce composant ne fait que de l'affichage.

import { useState, useSyncExternalStore } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown, MessageCircle, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useCustomerChat } from '@/features/chat/use-customer-chat';

/** true à partir de 768 px (le point de rupture md de Tailwind). */
function useIsDesktop() {
  const query = '(min-width: 48rem)';
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();
  // open : rien n'est chargé tant que le chat n'a pas été ouvert (RGESN)
  const chat = useCustomerChat(open);

  const footerNote = chat.isGuest && (
    <p className="text-xs text-muted-foreground">
      Vous écrivez en tant qu'invité.{' '}
      <Link to="/connexion" className="text-primary underline">
        Se connecter
      </Link>
    </p>
  );

  const fab = (
    <Button
      size="icon"
      aria-label={open ? 'Masquer le chat' : 'Ouvrir le chat'}
      className="fixed right-4 bottom-4 z-40 size-14 rounded-full shadow-lg md:right-6 md:bottom-6"
    >
      {open ? (
        <ChevronDown className="size-6" aria-hidden="true" />
      ) : (
        <MessageCircle className="size-6" aria-hidden="true" />
      )}
    </Button>
  );

  if (isDesktop) {
    return (
      // modal : Radix piège le focus dans le popover ; Échap le ferme et rend le focus au bouton
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>{fab}</PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={16}
          aria-label={`Chat : ${chat.title}`}
          className="h-[600px] max-h-[calc(100dvh-7rem)] w-[380px] overflow-hidden rounded-xl p-0 shadow-lg"
        >
          <ChatPanel
            chat={chat}
            viewer="client"
            footerNote={footerNote}
            titleNode={
              <h2 className="text-base font-extrabold">{chat.title}</h2>
            }
            headerAction={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Réduire le chat"
                onClick={() => setOpen(false)}
                className="size-11"
              >
                <Minus aria-hidden="true" />
              </Button>
            }
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{fab}</SheetTrigger>

      <SheetContent
        side="bottom"
        className="h-dvh gap-0 rounded-none p-0 [&>button]:hidden"
      >
        <SheetDescription className="sr-only">
          Conversation avec un conseiller
        </SheetDescription>
        <ChatPanel
          chat={chat}
          viewer="client"
          footerNote={footerNote}
          // SheetTitle nomme la boîte de dialogue : Radix avertit s'il manque
          titleNode={
            <SheetTitle className="text-base font-extrabold">
              {chat.title}
            </SheetTitle>
          }
          headerAction={
            <SheetClose asChild>
              <Button variant="ghost" className="h-11">
                <X aria-hidden="true" />
                Fermer
              </Button>
            </SheetClose>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
