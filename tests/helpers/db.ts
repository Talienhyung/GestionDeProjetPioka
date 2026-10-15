import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

export interface TestDb {
  prisma: PrismaClient
  cleanup: () => Promise<void>
}

/**
 * Chemin du gabarit : une base vide au schéma courant, construite une seule
 * fois par version du schéma. Chaque test en fait une copie, ce qui coûte
 * quelques millisecondes au lieu d'un `prisma db push` (plusieurs secondes).
 */
export function templatePath(): string {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  const hash = createHash('sha256').update(schema).digest('hex').slice(0, 12)
  return join(tmpdir(), `cap-schema-${hash}.db`)
}

/** Construit le gabarit s'il manque. Appelé par le globalSetup de Vitest. */
export function ensureTemplate(): string {
  const target = templatePath()
  if (existsSync(target)) return target

  const dir = mkdtempSync(join(tmpdir(), 'cap-template-'))
  const built = join(dir, 'template.db')
  execFileSync('node_modules/.bin/prisma', ['db', 'push', '--skip-generate', '--accept-data-loss'], {
    env: { ...process.env, DATABASE_URL: `file:${built}` },
    stdio: 'ignore',
  })
  // renameSync est atomique : deux processus concurrents ne peuvent pas
  // laisser un gabarit à moitié écrit derrière eux.
  renameSync(built, target)
  rmSync(dir, { recursive: true, force: true })
  return target
}

/** Crée une base SQLite jetable, schéma appliqué, isolée par test. */
export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), 'cap-test-'))
  const file = join(dir, 'test.db')
  copyFileSync(ensureTemplate(), file)

  const prisma = new PrismaClient({ datasourceUrl: `file:${file}` })

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
