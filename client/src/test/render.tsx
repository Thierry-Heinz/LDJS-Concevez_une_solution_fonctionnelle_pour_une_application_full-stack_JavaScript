import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { routeTree } from '@/routeTree.gen';

/** Un cache neuf par test, sans nouvelle tentative : une erreur simulée remonte immédiatement. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Rendu d'un composant isolé avec un `QueryClientProvider`. */
export function renderWithQuery(
  ui: ReactElement,
  queryClient = createTestQueryClient(),
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}

/**
 * Rendu de l'application complète (layout racine, vraies routes) sur une URL donnée, avec un historique en mémoire.
 * Sert aux tests d'intégration : seul le réseau est simulé (MSW).
 */
export function renderApp(
  initialPath = '/',
  queryClient = createTestQueryClient(),
) {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return {
    router,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

/**
 * Rendu d'un composant qui contient des `Link` : il est placé dans un routeur minimal, sans les vraies routes.
 * Le rendu du routeur est asynchrone : utiliser les requêtes `findBy…` pour le premier élément attendu.
 */
export function renderWithRouter(
  ui: ReactElement,
  queryClient = createTestQueryClient(),
) {
  const rootRoute = createRootRoute({ component: () => ui });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  return {
    router,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}
