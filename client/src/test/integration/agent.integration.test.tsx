import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation, UserProfile } from '@/types/api';
import { fakeSocket, socketModuleMock } from '@/test/fake-socket';
import {
  customerProfile,
  makeConversation,
  makeMessage,
} from '@/test/fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';
import { commonHandlers, setSessionHint } from './handlers';

/**
 * Tableau de bord agent sur l'application complète : garde de route, liste, sélection par l'URL (`?c=`), chat.
 */
vi.mock('@/lib/socket', () =>
  import('@/test/fake-socket').then((m) => m.socketModuleMock),
);

const agentProfile: UserProfile = {
  id: 'agent-1',
  email: 'central@ycyw.test',
  role: 'AGENT',
  firstName: [],
  lastName: [],
};

const fromCustomer = makeConversation({ id: 'conv-1' });
const fromGuest = makeConversation({
  id: 'conv-2',
  customerId: null,
  guestId: 'guest-1',
  origin: 'AGENCY',
  openedAt: '2026-11-13T10:15:00.000Z',
});

function signedInAs(
  profile: UserProfile,
  open: Conversation[] = [fromCustomer, fromGuest],
) {
  setSessionHint();
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(profile)),
    http.get('/api/conversations/open', () => HttpResponse.json(open)),
    http.get('/api/conversations/conv-1/messages', () =>
      HttpResponse.json([
        makeMessage({ content: 'Ma réservation est-elle confirmée ?' }),
      ]),
    ),
    http.get('/api/conversations/conv-2/messages', () => HttpResponse.json([])),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeSocket.reset();
  server.use(...commonHandlers);
});

describe('Accès au tableau de bord agent', () => {
  it('redirige un visiteur vers la connexion, en mémorisant la page demandée', async () => {
    const { router } = renderApp('/agent');

    expect(
      await screen.findByRole('heading', { name: 'Connexion' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');
    expect(router.state.location.search).toEqual({ redirect: '/agent' });
  });

  it("renvoie un client vers l'accueil", async () => {
    signedInAs(customerProfile);
    const { router } = renderApp('/agent');

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('Tableau de bord agent', () => {
  it("liste les conversations ouvertes de l'agence", async () => {
    signedInAs(agentProfile);
    renderApp('/agent');

    const nav = await screen.findByRole('navigation', {
      name: 'Conversations ouvertes',
    });
    expect(within(nav).getByRole('heading')).toHaveTextContent(
      'Conversations ouvertes (2)',
    );
    const items = within(nav).getAllByRole('button');
    expect(items[0]).toHaveTextContent('ClientService client');
    expect(items[1]).toHaveTextContent('InvitéAgence');
    expect(
      screen.getByText('Aucune conversation sélectionnée'),
    ).toBeInTheDocument();
  });

  it('affiche un état vide sans conversation ouverte', async () => {
    signedInAs(agentProfile, []);
    renderApp('/agent');

    expect(
      await screen.findByText('Aucune conversation ouverte'),
    ).toBeInTheDocument();
  });

  it("ouvre la conversation choisie, l'inscrit dans l'URL et rejoint sa room", async () => {
    signedInAs(agentProfile);
    const { router } = renderApp('/agent');

    const nav = await screen.findByRole('navigation', {
      name: 'Conversations ouvertes',
    });
    await userEvent.click(within(nav).getAllByRole('button')[0]);

    const section = screen.getByRole('region', { name: 'Conversation' });
    expect(
      await within(section).findByText('Ma réservation est-elle confirmée ?'),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole('heading', { name: 'Alice' }),
    ).toBeInTheDocument();
    expect(within(nav).getAllByRole('button')[0]).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(router.state.location.search).toEqual({ c: 'conv-1' });
    await waitFor(() =>
      expect(socketModuleMock.joinConversation).toHaveBeenCalledWith('conv-1'),
    );
  });

  it('ouvre directement la conversation passée dans ?c=', async () => {
    signedInAs(agentProfile);
    renderApp('/agent?c=conv-2');

    const section = await screen.findByRole('region', { name: 'Conversation' });
    expect(
      await within(section).findByRole('heading', { name: 'Invité' }),
    ).toBeInTheDocument();
  });

  it('répond au client et affiche le message diffusé par le serveur', async () => {
    signedInAs(agentProfile);
    renderApp('/agent?c=conv-1');
    const section = await screen.findByRole('region', { name: 'Conversation' });
    await within(section).findByText('Ma réservation est-elle confirmée ?');

    await userEvent.type(
      within(section).getByLabelText('Votre message'),
      'Oui, elle est confirmée.',
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'Envoyer' }),
    );

    await waitFor(() =>
      expect(socketModuleMock.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: 'Oui, elle est confirmée.',
      }),
    );

    act(() =>
      fakeSocket.serverEmit(
        'message:new',
        makeMessage({
          id: 'm-agent',
          senderType: 'AGENT',
          senderUserId: 'agent-1',
          senderAgencyId: 'agency-central',
          senderAgency: { name: 'Service client central' },
          senderUser: { customer: null },
          content: 'Oui, elle est confirmée.',
        }),
      ),
    );

    expect(
      await within(section).findByText('Vous avez rejoint la conversation'),
    ).toBeInTheDocument();
    expect(
      within(section).getByText('Oui, elle est confirmée.'),
    ).toBeInTheDocument();
  });

  it('termine la conversation, qui disparaît de la liste', async () => {
    let open = [fromCustomer, fromGuest];
    signedInAs(agentProfile);
    server.use(
      http.get('/api/conversations/open', () => HttpResponse.json(open)),
    );
    renderApp('/agent?c=conv-1');
    const section = await screen.findByRole('region', { name: 'Conversation' });
    await within(section).findByText('Ma réservation est-elle confirmée ?');

    await userEvent.click(
      within(section).getByRole('button', { name: 'Terminer la conversation' }),
    );
    expect(socketModuleMock.closeConversation).toHaveBeenCalledWith('conv-1');

    // Le serveur confirme la clôture à tous les participants.
    open = [fromGuest];
    act(() =>
      fakeSocket.serverEmit('conversation:closed', {
        conversationId: 'conv-1',
        closedAt: '2026-11-13T11:00:00.000Z',
        closedBy: { type: 'AGENT', displayName: 'Service client central' },
      }),
    );

    const nav = screen.getByRole('navigation', {
      name: 'Conversations ouvertes',
    });
    await waitFor(() =>
      expect(within(nav).getByRole('heading')).toHaveTextContent('(1)'),
    );
    expect(
      await screen.findByText('Aucune conversation sélectionnée'),
    ).toBeInTheDocument();
  });
});
