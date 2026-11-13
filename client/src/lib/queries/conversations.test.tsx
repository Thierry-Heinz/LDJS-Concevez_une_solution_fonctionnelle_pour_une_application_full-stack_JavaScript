import type { ReactNode } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentConversationQuery,
  useStartConversation,
} from '@/lib/queries/conversations';
import { makeConversation } from '@/test/fixtures';
import { server } from '@/test/msw-server';
import { createTestQueryClient } from '@/test/render';
import { socketModuleMock } from '@/test/fake-socket';

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

beforeEach(() => vi.clearAllMocks());

describe('currentConversationQuery', () => {
  it.each([401, 404])(
    'renvoie null sur un %i (pas de conversation en cours)',
    async (status) => {
      server.use(
        http.get('/api/conversations/current', () =>
          HttpResponse.json({ message: 'x' }, { status }),
        ),
        http.post(
          '/api/auth/refresh',
          () => new HttpResponse(null, { status: 401 }),
        ),
      );
      const { wrapper } = setup();

      const { result } = renderHook(() => useQuery(currentConversationQuery), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    },
  );
});

describe('useStartConversation', () => {
  it("obtient d'abord un cookie invité pour un visiteur, puis crée une conversation générale", async () => {
    const calls: string[] = [];
    let body: unknown;
    server.use(
      http.post('/api/auth/guest', () => {
        calls.push('guest');
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('/api/conversations', async ({ request }) => {
        calls.push('conversations');
        body = await request.json();
        return HttpResponse.json(makeConversation(), { status: 201 });
      }),
    );
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useStartConversation(), { wrapper });
    await result.current.mutateAsync({ asGuest: true });

    expect(calls).toEqual(['guest', 'conversations']);
    expect(body).toEqual({ origin: 'GENERAL' });
    expect(queryClient.getQueryData(currentConversationQuery.queryKey)).toEqual(
      makeConversation(),
    );
    expect(socketModuleMock.reconnectSocket).toHaveBeenCalledOnce();
  });

  it("adresse la conversation à l'agence fournie, sans cookie invité pour un client", async () => {
    const onGuest = vi.fn();
    let body: unknown;
    server.use(
      http.post('/api/auth/guest', onGuest),
      http.post('/api/conversations', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          makeConversation({ origin: 'AGENCY', agencyId: 'agency-1' }),
        );
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useStartConversation(), { wrapper });
    await result.current.mutateAsync({ asGuest: false, agencyId: 'agency-1' });

    expect(onGuest).not.toHaveBeenCalled();
    expect(body).toEqual({ origin: 'AGENCY', agencyId: 'agency-1' });
  });

  it('recharge la conversation en cours sur un 409 (conversation déjà ouverte ailleurs)', async () => {
    const existing = makeConversation({ id: 'conv-existing' });
    server.use(
      http.post('/api/conversations', () =>
        HttpResponse.json(
          { message: 'Déjà ouverte', code: 'CONVERSATION_ALREADY_OPEN' },
          { status: 409 },
        ),
      ),
      http.get('/api/conversations/current', () => HttpResponse.json(existing)),
    );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(currentConversationQuery.queryKey, null);

    const { result } = renderHook(
      () => ({
        current: useQuery({ ...currentConversationQuery, staleTime: Infinity }),
        start: useStartConversation(),
      }),
      { wrapper },
    );
    await expect(
      result.current.start.mutateAsync({ asGuest: false }),
    ).rejects.toMatchObject({ status: 409 });

    await waitFor(() => expect(result.current.current.data).toEqual(existing));
  });
});
