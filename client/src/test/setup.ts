import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw-server';

/** Toute requête non prévue par un handler fait échouer le test : aucun appel réseau réel ne passe. */
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  document.cookie.split('; ').forEach((cookie) => {
    const name = cookie.split('=')[0];
    if (name)
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
});

afterAll(() => server.close());

/** API du navigateur absentes de jsdom, utilisées par le widget (matchMedia), la liste de messages (scrollIntoView) et Radix (ResizeObserver). */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })),
});

Element.prototype.scrollIntoView = function scrollIntoView() {};

/** Appelé par TanStack Router à chaque navigation (retour en haut de page). */
window.scrollTo = () => {};

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
