import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useChatCacheSync,
  useSocketConnected,
} from '@/features/chat/use-chat-sync';
import {
  currentConversationQuery,
  messagesQuery,
  openConversationsQuery,
} from '@/lib/queries/conversations';
import { fakeSocket } from '@/test/fake-socket';
import { makeConversation, makeMessage } from '@/test/fixtures';
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

describe('useSocketConnected', () => {
  it("suit l'état de connexion du socket", async () => {
    const { result } = renderHook(() => useSocketConnected());
    expect(result.current).toBe(false);

    await act(async () => void fakeSocket.connect());
    expect(result.current).toBe(true);

    act(() => void fakeSocket.disconnect());
    expect(result.current).toBe(false);
  });
});

describe('useChatCacheSync', () => {
  it('ajoute un nouveau message au cache de sa conversation', () => {
    const { queryClient, wrapper } = setup();
    const key = messagesQuery('conv-1').queryKey;
    queryClient.setQueryData(key, [makeMessage({ id: 'm1' })]);
    renderHook(() => useChatCacheSync(), { wrapper });

    act(() =>
      fakeSocket.serverEmit(
        'message:new',
        makeMessage({ id: 'm2', content: 'Suite' }),
      ),
    );

    expect(queryClient.getQueryData(key)?.map((m) => m.id)).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('crée la liste si l’historique n’est pas encore chargé', () => {
    const { queryClient, wrapper } = setup();
    renderHook(() => useChatCacheSync(), { wrapper });

    act(() => fakeSocket.serverEmit('message:new', makeMessage({ id: 'm1' })));

    expect(
      queryClient.getQueryData(messagesQuery('conv-1').queryKey),
    ).toHaveLength(1);
  });

  it('remplace un message déjà présent au lieu de le dupliquer', () => {
    const { queryClient, wrapper } = setup();
    const key = messagesQuery('conv-1').queryKey;
    queryClient.setQueryData(key, [
      makeMessage({ id: 'm1', content: 'Avant' }),
    ]);
    renderHook(() => useChatCacheSync(), { wrapper });

    act(() =>
      fakeSocket.serverEmit(
        'message:new',
        makeMessage({ id: 'm1', content: 'Après' }),
      ),
    );

    expect(queryClient.getQueryData(key)).toEqual([
      makeMessage({ id: 'm1', content: 'Après' }),
    ]);
  });

  it('passe la conversation en cours à CLOSED et rafraîchit la liste agent à la clôture', () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(
      currentConversationQuery.queryKey,
      makeConversation(),
    );
    queryClient.setQueryData(openConversationsQuery.queryKey, [
      makeConversation(),
    ]);
    renderHook(() => useChatCacheSync(), { wrapper });

    act(() =>
      fakeSocket.serverEmit('conversation:closed', {
        conversationId: 'conv-1',
        closedAt: '2026-11-13T10:00:00.000Z',
        closedBy: { type: 'AGENT', displayName: null },
      }),
    );

    expect(
      queryClient.getQueryData(currentConversationQuery.queryKey)?.status,
    ).toBe('CLOSED');
    expect(
      queryClient.getQueryState(openConversationsQuery.queryKey)?.isInvalidated,
    ).toBe(true);
  });

  it("ne touche pas la conversation en cours si c'est une autre qui est close", () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(
      currentConversationQuery.queryKey,
      makeConversation(),
    );
    renderHook(() => useChatCacheSync(), { wrapper });

    act(() =>
      fakeSocket.serverEmit('conversation:closed', {
        conversationId: 'autre',
        closedAt: '2026-11-13T10:00:00.000Z',
        closedBy: { type: 'AGENT', displayName: null },
      }),
    );

    expect(
      queryClient.getQueryData(currentConversationQuery.queryKey)?.status,
    ).toBe('OPEN');
  });

  it('invalide toutes les conversations après une reconnexion', () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(messagesQuery('conv-1').queryKey, []);
    queryClient.setQueryData(
      currentConversationQuery.queryKey,
      makeConversation(),
    );
    renderHook(() => useChatCacheSync(), { wrapper });

    act(() => fakeSocket.io.emit('reconnect'));

    expect(
      queryClient.getQueryState(messagesQuery('conv-1').queryKey)
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(currentConversationQuery.queryKey)
        ?.isInvalidated,
    ).toBe(true);
  });

  it('retire ses écouteurs au démontage', () => {
    const { wrapper } = setup();
    const { unmount } = renderHook(() => useChatCacheSync(), { wrapper });
    expect(fakeSocket.listenerCount('message:new')).toBe(1);

    unmount();

    expect(fakeSocket.listenerCount('message:new')).toBe(0);
    expect(fakeSocket.listenerCount('conversation:closed')).toBe(0);
  });
});
