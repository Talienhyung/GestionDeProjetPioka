import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

export interface TestDb {
  prisma: PrismaClient
  cleanup: () => Promise<void>
}

/** Crée une base SQLite jetable, schéma appliqué, isolée par test. */
export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), 'cap-test-'))
  const url = `file:${join(dir, 'test.db')}`

  execFileSync('node_modules/.bin/prisma', ['db', 'push', '--skip-generate', '--accept-data-loss'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  })

  const prisma = new PrismaClient({ datasourceUrl: url })

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
