import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Base dédiée, recréée à chaque lancement par e2e/helpers/seed.ts.
const DATABASE_URL = (() => {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://cap:cap@localhost:5432/cap')
  url.pathname = '/cap_e2e'
  return url.toString()
})()

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // Le serveur de développement compile chaque route à sa première visite :
  // le parcours complet en traverse une demi-douzaine.
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3100', locale: 'fr-FR' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // Serveur de développement : en production le cookie de session est marqué
    // Secure, et Playwright parle en HTTP simple. Le build de production est
    // vérifié séparément par `npm run build`.
    command: 'npx tsx e2e/helpers/seed.ts && npx next dev -p 3100',
    url: 'http://localhost:3100/login',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL,
      DIRECT_URL: DATABASE_URL,
      UPLOAD_DIR: join(process.cwd(), 'e2e/uploads'),
      // Les photos des tests restent sur le disque, même si S3 est configuré.
      S3_BUCKET: '',
    },
  },
})
