import type { ReactNode } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { meQuery, useLogin, useLogout } from '@/lib/queries/auth';
import { conversationsKey } from '@/lib/queries/conversations';
import {
  customerProfile,
  customerSession,
  makeConversation,
} from '@/test/fixtures';
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

describe('meQuery', () => {
  it("n'appelle pas l'API sans cookie indicateur de session", async () => {
    const onMe = vi.fn();
    server.use(http.get('/api/auth/me', onMe));
    const { wrapper } = setup();

    const { result } = renderHook(() => useQuery(meQuery), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(onMe).not.toHaveBeenCalled();
  });

  it('charge le profil quand le cookie has_session est présent', async () => {
    document.cookie = 'has_session=1';
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(customerProfile)),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useQuery(meQuery), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(customerProfile));
  });

  it('renvoie null si la session a expiré et ne peut pas être rafraîchie', async () => {
    document.cookie = 'has_session=1';
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
      http.post(
        '/api/auth/refresh',
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useQuery(meQuery), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('useLogin', () => {
  it('recharge le profil, vide les conversations du cache et reconnecte le socket', async () => {
    document.cookie = 'has_session=1';
    server.use(
      http.post('/api/auth/login', () => HttpResponse.json(customerSession)),
      http.get('/api/auth/me', () => HttpResponse.json(customerProfile)),
    );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(meQuery.queryKey, null);
    queryClient.setQueryData(
      [...conversationsKey, 'current'],
      makeConversation(),
    );

    // Comme dans l'application, le profil est observé (par l'en-tête) : l'invalidation le recharge.
    const { result } = renderHook(
      () => ({ me: useQuery(meQuery), login: useLogin() }),
      { wrapper },
    );
    await result.current.login.mutateAsync({
      email: 'alice@exemple.fr',
      password: 'secret',
    });

    await waitFor(() =>
      expect(result.current.me.data).toEqual(customerProfile),
    );
    expect(
      queryClient.getQueryData([...conversationsKey, 'current']),
    ).toBeUndefined();
    expect(socketModuleMock.reconnectSocket).toHaveBeenCalledOnce();
  });
});

describe('useLogout', () => {
  it('passe le profil à null sans nouvelle requête et vide les conversations', async () => {
    const onMe = vi.fn();
    server.use(
      http.post(
        '/api/auth/logout',
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get('/api/auth/me', onMe),
    );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(meQuery.queryKey, customerProfile);
    queryClient.setQueryData(
      [...conversationsKey, 'current'],
      makeConversation(),
    );

    const { result } = renderHook(() => useLogout(), { wrapper });
    await result.current.mutateAsync();

    expect(queryClient.getQueryData(meQuery.queryKey)).toBeNull();
    expect(
      queryClient.getQueryData([...conversationsKey, 'current']),
    ).toBeUndefined();
    expect(onMe).not.toHaveBeenCalled();
    expect(socketModuleMock.reconnectSocket).toHaveBeenCalledOnce();
  });
});
