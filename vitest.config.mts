import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vite résout nativement les chemins de tsconfig (alias « @/ » vers src/).
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    // Chaque test d'intégration crée son propre fichier SQLite : Prisma
    // n'apprécie pas les threads partagés.
    pool: 'forks',
  },
})
