import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationMessages } from '@/features/chat/use-conversation';
import { currentConversationQuery } from '@/lib/queries/conversations';
import { fakeSocket, socketModuleMock } from '@/test/fake-socket';
import { makeMessage } from '@/test/fixtures';
import { server } from '@/test/msw-server';
import { createTestQueryClient } from '@/test/render';

vi.mock('@/lib/socket', () =>
  import('@/test/fake-socket').then((m) => m.socketModuleMock),
);

function setup() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeSocket.reset();
});

describe('useConversationMessages', () => {
  it("ne fait rien tant qu'il n'y a pas de conversation", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useConversationMessages(undefined), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fakeSocket.connect).not.toHaveBeenCalled();
    expect(socketModuleMock.joinConversation).not.toHaveBeenCalled();
  });

  it("charge l'historique, ouvre le socket puis rejoint la room une fois connecté", async () => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([makeMessage()]),
      ),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useConversationMessages('conv-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual([makeMessage()]));
    expect(fakeSocket.connect).toHaveBeenCalledOnce();
    expect(socketModuleMock.joinConversation).toHaveBeenCalledWith('conv-1');
  });

  it('rejoint à nouveau la room après chaque reconnexion', async () => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([]),
      ),
    );
    fakeSocket.connected = true;
    const { wrapper } = setup();

    renderHook(() => useConversationMessages('conv-1'), { wrapper });
    expect(socketModuleMock.joinConversation).toHaveBeenCalledTimes(1);

    await act(async () => {
      fakeSocket.disconnect();
      fakeSocket.connect();
    });
    expect(socketModuleMock.joinConversation).toHaveBeenCalledTimes(2);
  });

  it("recharge la conversation en cours si le serveur refuse l'accès à la room", async () => {
    server.use(
      http.get('/api/conversations/conv-1/messages', () =>
        HttpResponse.json([]),
      ),
    );
    socketModuleMock.joinConversation.mockRejectedValueOnce(
      new Error('CONVERSATION_CLOSED'),
    );
    fakeSocket.connected = true;
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(currentConversationQuery.queryKey, null);

    renderHook(() => useConversationMessages('conv-1'), { wrapper });

    await waitFor(() =>
      expect(
        queryClient.getQueryState(currentConversationQuery.queryKey)
          ?.isInvalidated,
      ).toBe(true),
    );
  });
});
