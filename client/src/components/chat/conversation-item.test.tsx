import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConversationItem } from '@/components/chat/conversation-item';
import { makeConversation } from '@/test/fixtures';

describe('ConversationItem', () => {
  it("affiche le type d'interlocuteur, l'origine et la date d'ouverture", () => {
    render(
      <ConversationItem
        conversation={makeConversation()}
        selected={false}
        onSelect={() => {}}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Client');
    expect(button).toHaveTextContent('Service client');
    expect(screen.getByText(/\d{2}\/\d{2}/)).toHaveAttribute(
      'datetime',
      '2026-11-13T09:30:00.000Z',
    );
  });

  it("distingue un invité d'une demande en agence", () => {
    render(
      <ConversationItem
        conversation={makeConversation({
          customerId: null,
          guestId: 'g1',
          origin: 'AGENCY',
        })}
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Invité');
    expect(screen.getByRole('button')).toHaveTextContent('Agence');
  });

  it('expose la sélection aux lecteurs d’écran', () => {
    const { rerender } = render(
      <ConversationItem
        conversation={makeConversation()}
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-current');

    rerender(
      <ConversationItem
        conversation={makeConversation()}
        selected
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('appelle onSelect au clic', async () => {
    const onSelect = vi.fn();
    render(
      <ConversationItem
        conversation={makeConversation()}
        selected={false}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledOnce();
  });
});
