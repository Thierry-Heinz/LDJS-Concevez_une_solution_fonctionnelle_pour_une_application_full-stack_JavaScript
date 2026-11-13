import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '@/components/chat/chat-panel';
import type { ChatController } from '@/features/chat/chat-controller';
import { fakeSocket } from '@/test/fake-socket';
import { renderWithRouter } from '@/test/render';

vi.mock('@/lib/socket', () =>
  import('@/test/fake-socket').then((m) => m.socketModuleMock),
);

function makeChat(overrides: Partial<ChatController> = {}): ChatController {
  return {
    title: 'Service client',
    messages: [],
    isLoading: false,
    hasConversation: true,
    closed: false,
    isSending: false,
    draft: '',
    setDraft: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
    ...overrides,
  };
}

async function renderPanel(chat: ChatController) {
  renderWithRouter(
    <ChatPanel chat={chat} viewer="client" titleNode={<h2>{chat.title}</h2>} />,
  );
  await screen.findByRole('heading', { name: chat.title });
}

beforeEach(() => {
  fakeSocket.reset();
  fakeSocket.connected = true;
});

describe('ChatPanel', () => {
  it('envoie le brouillon nettoyé puis vide le champ', async () => {
    const chat = makeChat({ draft: '  Bonjour  ' });
    await renderPanel(chat);

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(chat.send).toHaveBeenCalledWith('Bonjour');
    expect(chat.setDraft).toHaveBeenCalledWith('');
  });

  it('envoie aussi avec la touche Entrée', async () => {
    const chat = makeChat({ draft: 'Bonjour' });
    await renderPanel(chat);

    await userEvent.type(screen.getByLabelText('Votre message'), '{Enter}');

    expect(chat.send).toHaveBeenCalledWith('Bonjour');
  });

  it("n'envoie pas un message vide", async () => {
    const chat = makeChat({ draft: '   ' });
    await renderPanel(chat);

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(chat.send).not.toHaveBeenCalled();
  });

  it('bloque le bouton pendant un envoi', async () => {
    await renderPanel(makeChat({ draft: 'Bonjour', isSending: true }));
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });

  it('transmet la saisie au contrôleur', async () => {
    const chat = makeChat();
    await renderPanel(chat);

    await userEvent.type(screen.getByLabelText('Votre message'), 'A');

    expect(chat.setDraft).toHaveBeenCalledWith('A');
  });

  it('permet de terminer une conversation en cours', async () => {
    const chat = makeChat();
    await renderPanel(chat);
    expect(screen.getByText('En cours')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Terminer la conversation' }),
    );

    expect(chat.end).toHaveBeenCalledOnce();
  });

  it('remplace la saisie par un message et un bouton « Nouvelle conversation » une fois terminée', async () => {
    const chat = makeChat({ closed: true, restart: vi.fn() });
    await renderPanel(chat);

    expect(screen.queryByLabelText('Votre message')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Terminer la conversation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Vous ne pouvez plus y écrire/),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Nouvelle conversation' }),
    );
    expect(chat.restart).toHaveBeenCalledOnce();
  });

  it("n'offre pas de nouvelle conversation sans `restart` (côté agent)", async () => {
    await renderPanel(makeChat({ closed: true }));
    expect(
      screen.queryByRole('button', { name: 'Nouvelle conversation' }),
    ).not.toBeInTheDocument();
  });

  it('affiche un bandeau et désactive la saisie quand la connexion est perdue', async () => {
    await renderPanel(makeChat({ draft: 'Bonjour' }));
    expect(screen.queryByText(/Connexion perdue/)).not.toBeInTheDocument();

    act(() => void fakeSocket.disconnect());

    expect(screen.getByRole('status')).toHaveTextContent(
      'Connexion perdue. Reconnexion en cours…',
    );
    expect(screen.getByLabelText('Votre message')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });

  it("n'affiche pas le bandeau hors ligne avant le début d'une conversation", async () => {
    fakeSocket.connected = false;
    await renderPanel(makeChat({ hasConversation: false }));

    expect(screen.queryByText(/Connexion perdue/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Votre message')).toBeEnabled();
  });
});
