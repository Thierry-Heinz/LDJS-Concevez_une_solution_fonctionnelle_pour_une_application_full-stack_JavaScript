import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageList } from '@/components/chat/message-list';
import { makeMessage } from '@/test/fixtures';
import { renderWithRouter } from '@/test/render';

const customerMessage = makeMessage({
  id: 'm1',
  content: 'Bonjour, une question',
});
const agentMessage = makeMessage({
  id: 'm2',
  senderType: 'AGENT',
  senderUserId: 'agent-1',
  senderAgencyId: 'agency-1',
  senderAgency: { name: 'Agence de Lyon' },
  senderUser: { customer: null },
  content: 'Je vous écoute',
});

async function renderList(props: Parameters<typeof MessageList>[0]) {
  renderWithRouter(<MessageList {...props} />);
  return screen.findByRole('log', { name: 'Messages' });
}

describe('MessageList', () => {
  it('est une zone annoncée poliment aux lecteurs d’écran', async () => {
    const log = await renderList({ messages: [], viewer: 'client' });
    expect(log).toHaveAttribute('aria-live', 'polite');
  });

  it('invite à poser une question quand il n’y a pas encore de message', async () => {
    await renderList({ messages: [], viewer: 'client' });
    expect(screen.getByText('Posez votre question')).toBeInTheDocument();
  });

  it("n'affiche pas l'état vide pendant le chargement", async () => {
    await renderList({ messages: [], viewer: 'client', isLoading: true });
    expect(screen.queryByText('Posez votre question')).not.toBeInTheDocument();
  });

  it('côté client : « Vous » pour ses messages, le nom de l’agence pour le conseiller', async () => {
    const log = await renderList({
      messages: [customerMessage, agentMessage],
      viewer: 'client',
    });
    const items = within(log).getAllByRole('listitem');

    expect(
      items.find((li) => li.textContent?.includes('Bonjour, une question')),
    ).toHaveTextContent('Vous');
    expect(
      items.find((li) => li.textContent?.includes('Je vous écoute')),
    ).toHaveTextContent('Agence de Lyon');
    expect(
      screen.getByText('Un conseiller a rejoint la conversation'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'En savoir plus' }),
    ).toHaveAttribute('href', '/donnees-personnelles');
  });

  it('côté agent : le prénom du client, « Vous » pour ses propres messages, sans mention RGPD', async () => {
    const log = await renderList({
      messages: [customerMessage, agentMessage],
      viewer: 'agent',
    });
    const items = within(log).getAllByRole('listitem');

    expect(
      items.find((li) => li.textContent?.includes('Bonjour, une question')),
    ).toHaveTextContent('Alice');
    expect(
      items.find((li) => li.textContent?.includes('Je vous écoute')),
    ).toHaveTextContent('Vous');
    expect(
      screen.getByText('Vous avez rejoint la conversation'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'En savoir plus' }),
    ).not.toBeInTheDocument();
  });

  it('nomme « Invité » un expéditeur sans compte', async () => {
    await renderList({
      messages: [
        makeMessage({
          senderType: 'GUEST',
          senderUserId: null,
          senderUser: null,
        }),
      ],
      viewer: 'agent',
    });
    expect(screen.getByText('Invité')).toBeInTheDocument();
  });

  it('signale la fin de la conversation', async () => {
    await renderList({
      messages: [customerMessage],
      viewer: 'client',
      closed: true,
    });
    expect(screen.getByText('Conversation terminée')).toBeInTheDocument();
  });
});
