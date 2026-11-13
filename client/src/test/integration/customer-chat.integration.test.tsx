import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '@/types/api';
import { fakeSocket, socketModuleMock } from '@/test/fake-socket';
import {
  agency,
  customerProfile,
  makeConversation,
  makeMessage,
} from '@/test/fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';
import { commonHandlers, setSessionHint } from './handlers';

/**
 * Parcours du chat client sur l'application complète : widget, contrôleur, cache et synchronisation réels.
 * Le serveur HTTP est simulé par MSW, le serveur Socket.IO par le faux socket (`serverEmit`).
 */
vi.mock('@/lib/socket', () =>
  import('@/test/fake-socket').then((m) => m.socketModuleMock),
);

/** Simule le back : une seule conversation, créée par POST /conversations. */
function chatBackend() {
  const calls: string[] = [];
  let current: Conversation | null = null;
  let createBody: unknown;

  server.use(
    http.post('/api/auth/guest', () => {
      calls.push('POST /auth/guest');
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/conversations/current', () => {
      calls.push('GET /conversations/current');
      return current
        ? HttpResponse.json(current)
        : HttpResponse.json({ message: 'Not Found' }, { status: 404 });
    }),
    http.post('/api/conversations', async ({ request }) => {
      calls.push('POST /conversations');
      createBody = await request.json();
      current = makeConversation({
        customerId: null,
        guestId: 'guest-1',
        ...((createBody as { origin: string }).origin === 'AGENCY'
          ? { origin: 'AGENCY', agencyId: agency.id }
          : {}),
      });
      return HttpResponse.json(current, { status: 201 });
    }),
    http.get('/api/conversations/:id/messages', () => HttpResponse.json([])),
  );

  return { calls, createBody: () => createBody };
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeSocket.reset();
  server.use(...commonHandlers);
});

async function openChat() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Ouvrir le chat' }),
  );
  return screen.findByRole('dialog');
}

async function sendFromWidget(dialog: HTMLElement, text: string) {
  await userEvent.type(within(dialog).getByLabelText('Votre message'), text);
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Envoyer' }),
  );
}

describe('Chat client', () => {
  it("ne charge rien tant que le widget n'est pas ouvert (RGESN)", async () => {
    const backend = chatBackend();
    renderApp('/');

    await screen.findByRole('button', { name: 'Ouvrir le chat' });

    expect(backend.calls).toEqual([]);
    expect(fakeSocket.connect).not.toHaveBeenCalled();
  });

  it("permet à un visiteur d'écrire en invité au service client", async () => {
    const backend = chatBackend();
    renderApp('/');

    const dialog = await openChat();

    expect(
      within(dialog).getByRole('heading', { name: 'Service client' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Vous écrivez en tant qu'invité/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Posez votre question'),
    ).toBeInTheDocument();

    await sendFromWidget(dialog, 'Bonjour, je voudrais louer un utilitaire');

    await waitFor(() =>
      expect(socketModuleMock.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: 'Bonjour, je voudrais louer un utilitaire',
      }),
    );
    expect(backend.calls).toEqual([
      'GET /conversations/current',
      'POST /auth/guest',
      'POST /conversations',
    ]);
    expect(backend.createBody()).toEqual({ origin: 'GENERAL' });
    expect(socketModuleMock.joinConversation).toHaveBeenCalledWith('conv-1');
    expect(within(dialog).getByLabelText('Votre message')).toHaveValue('');
  });

  it('affiche en direct les messages diffusés par le serveur, puis la clôture', async () => {
    chatBackend();
    const { queryClient } = renderApp('/');
    const dialog = await openChat();
    await sendFromWidget(dialog, 'Bonjour');
    await waitFor(() =>
      expect(socketModuleMock.sendMessage).toHaveBeenCalled(),
    );
    // L'historique (vide) doit être chargé avant les événements : sinon sa réponse écraserait les messages reçus.
    await waitFor(() =>
      expect(
        queryClient.getQueryState(['conversations', 'conv-1', 'messages'])
          ?.status,
      ).toBe('success'),
    );

    act(() => {
      fakeSocket.serverEmit(
        'message:new',
        makeMessage({
          id: 'm1',
          senderType: 'GUEST',
          senderUserId: null,
          senderUser: null,
          content: 'Bonjour',
        }),
      );
      fakeSocket.serverEmit(
        'message:new',
        makeMessage({
          id: 'm2',
          senderType: 'AGENT',
          senderUserId: 'agent-1',
          senderAgencyId: 'agency-central',
          senderAgency: { name: 'Service client central' },
          senderUser: { customer: null },
          content: 'Bonjour, je regarde nos disponibilités.',
        }),
      );
    });

    // TanStack Query notifie les composants de façon asynchrone : d'où `findBy…`.
    const log = within(dialog).getByRole('log', { name: 'Messages' });
    expect(
      await within(log).findByText('Bonjour, je regarde nos disponibilités.'),
    ).toBeInTheDocument();
    expect(within(log).getByText('Service client central')).toBeInTheDocument();
    expect(
      within(log).getByText('Un conseiller a rejoint la conversation'),
    ).toBeInTheDocument();

    act(() =>
      fakeSocket.serverEmit('conversation:closed', {
        conversationId: 'conv-1',
        closedAt: '2026-11-13T10:00:00.000Z',
        closedBy: { type: 'AGENT', displayName: 'Service client central' },
      }),
    );

    expect(
      await within(dialog).findByText(/Vous ne pouvez plus y écrire/),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText('Votre message'),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Nouvelle conversation' }),
    );
    expect(
      await within(dialog).findByText('Posez votre question'),
    ).toBeInTheDocument();
  });

  it("adresse la conversation à l'agence de la page consultée", async () => {
    const backend = chatBackend();
    renderApp(`/agences/${agency.id}`);
    await screen.findByRole('heading', { level: 1, name: agency.name });

    const dialog = await openChat();
    expect(
      within(dialog).getByRole('heading', { name: agency.name }),
    ).toBeInTheDocument();

    await sendFromWidget(dialog, 'Êtes-vous ouverts dimanche ?');

    await waitFor(() =>
      expect(socketModuleMock.sendMessage).toHaveBeenCalled(),
    );
    expect(backend.createBody()).toEqual({
      origin: 'AGENCY',
      agencyId: agency.id,
    });
  });

  it("reprend la conversation déjà ouverte d'un client connecté, sans cookie invité", async () => {
    setSessionHint();
    const onGuest = vi.fn();
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(customerProfile)),
      http.post('/api/auth/guest', onGuest),
      http.get('/api/conversations/current', () =>
        HttpResponse.json(makeConversation()),
      ),
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([makeMessage({ content: 'Message de la veille' })]),
      ),
    );
    renderApp('/');

    const dialog = await openChat();

    expect(
      await within(dialog).findByText('Message de la veille'),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText(/en tant qu'invité/),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(socketModuleMock.joinConversation).toHaveBeenCalledWith('conv-1'),
    );

    await sendFromWidget(dialog, 'Me revoilà');

    await waitFor(() =>
      expect(socketModuleMock.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: 'Me revoilà',
      }),
    );
    expect(onGuest).not.toHaveBeenCalled();
  });

  it("prévient l'utilisateur et restaure son message si l'envoi échoue", async () => {
    chatBackend();
    socketModuleMock.sendMessage.mockRejectedValueOnce(new Error('TIMEOUT'));
    renderApp('/');
    const dialog = await openChat();

    await sendFromWidget(dialog, 'Message important');

    expect(
      await screen.findByText("Le message n'a pas pu être envoyé. Réessayez."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Votre message')).toHaveValue(
      'Message important',
    );
  });

  it('se ferme avec le bouton « Fermer » en conservant la conversation', async () => {
    chatBackend();
    renderApp('/');
    const dialog = await openChat();
    await userEvent.type(
      within(dialog).getByLabelText('Votre message'),
      'Brouillon',
    );

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Fermer' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    const reopened = await openChat();
    expect(within(reopened).getByLabelText('Votre message')).toHaveValue(
      'Brouillon',
    );
  });
});
