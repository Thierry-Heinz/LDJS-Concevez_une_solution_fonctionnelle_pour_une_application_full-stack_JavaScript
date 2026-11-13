import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * Configuration des tests : reprend celle de Vite (alias `@`, plugins) et ajoute l'environnement jsdom.
 * `*.test.ts(x)` : tests unitaires ; `*.integration.test.tsx` : tests d'intégration (vrai routeur, vrai cache, API simulée par MSW).
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/components/ui/**',
          'src/types/**',
          'src/routeTree.gen.ts',
          'src/main.tsx',
        ],
      },
    },
  }),
);
