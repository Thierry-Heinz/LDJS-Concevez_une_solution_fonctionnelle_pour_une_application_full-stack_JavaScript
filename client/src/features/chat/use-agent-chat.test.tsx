import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentChat } from '@/features/chat/use-agent-chat';
import { fakeSocket, socketModuleMock } from '@/test/fake-socket';
import { makeConversation, makeMessage } from '@/test/fixtures';
import { server } from '@/test/msw-server';
import { createTestQueryClient } from '@/test/render';

vi.mock('@/lib/socket', () =>
  import('@/test/fake-socket').then((m) => m.socketModuleMock),
);
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderAgentChat(conversation = makeConversation()) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAgentChat(conversation), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeSocket.reset();
  fakeSocket.connected = true;
});

describe('useAgentChat', () => {
  it("prend le prénom du client comme titre, une fois l'historique chargé", async () => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([makeMessage()]),
      ),
    );
    const { result } = renderAgentChat();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.title).toBe('Alice'));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.restart).toBeUndefined();
  });

  it.each([
    ['Client', 'user-1'],
    ['Invité', null],
  ])('affiche « %s » sans prénom connu', async (title, customerId) => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([]),
      ),
    );
    const { result } = renderAgentChat(makeConversation({ customerId }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.title).toBe(title);
  });

  it('signale une conversation close', () => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([]),
      ),
    );
    const { result } = renderAgentChat(makeConversation({ status: 'CLOSED' }));
    expect(result.current.closed).toBe(true);
  });

  it('envoie le message dans la conversation', async () => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([]),
      ),
    );
    const { result } = renderAgentChat();

    act(() => result.current.send('Bonjour, que puis-je faire ?'));

    await waitFor(() =>
      expect(socketModuleMock.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: 'Bonjour, que puis-je faire ?',
      }),
    );
  });

  it("restaure le brouillon et prévient l'agent si l'envoi échoue", async () => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([]),
      ),
    );
    socketModuleMock.sendMessage.mockRejectedValueOnce(new Error('TIMEOUT'));
    const { result } = renderAgentChat();

    act(() => result.current.send('Message perdu'));

    await waitFor(() => expect(result.current.draft).toBe('Message perdu'));
    expect(toast.error).toHaveBeenCalledWith(
      "Le message n'a pas pu être envoyé. Réessayez.",
    );
  });

  it('termine la conversation, et prévient en cas d’échec', async () => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([]),
      ),
    );
    const { result } = renderAgentChat();

    act(() => result.current.end());
    expect(socketModuleMock.closeConversation).toHaveBeenCalledWith('conv-1');

    socketModuleMock.closeConversation.mockRejectedValueOnce(
      new Error('TIMEOUT'),
    );
    act(() => result.current.end());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "La conversation n'a pas pu être terminée. Réessayez.",
      ),
    );
  });
});
