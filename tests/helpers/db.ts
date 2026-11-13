import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

export interface TestDb {
  prisma: PrismaClient
  cleanup: () => Promise<void>
}

/**
 * Serveur PostgreSQL des tests : par défaut celui de docker-compose.dev.yml,
 * TEST_DATABASE_URL pour en viser un autre (CI). Seule la partie serveur de
 * l'adresse compte : chaque test crée et supprime sa propre base.
 */
function urlFor(database: string): string {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://cap:cap@localhost:5432/cap')
  url.pathname = `/${database}`
  return url.toString()
}

async function withAdmin<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  const client = new PrismaClient({ datasourceUrl: urlFor('postgres') })
  try {
    return await fn(client)
  } finally {
    await client.$disconnect()
  }
}

/**
 * Base gabarit : vide, au schéma courant, construite une fois par version du
 * schéma. Chaque test la clone (CREATE DATABASE … TEMPLATE), ce qui coûte
 * quelques dizaines de millisecondes au lieu d'un `prisma db push`.
 */
export function templateName(): string {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  return `cap_tpl_${createHash('sha256').update(schema).digest('hex').slice(0, 12)}`
}

/** Construit le gabarit s'il manque. Appelé par le globalSetup de Vitest. */
export async function ensureTemplate(): Promise<string> {
  const name = templateName()
  return withAdmin(async (client) => {
    const exists = await client.$queryRawUnsafe<unknown[]>('SELECT 1 FROM pg_database WHERE datname = $1', name)
    if (exists.length > 0) return name

    // Construit sous un nom provisoire puis renommé : un gabarit interrompu à
    // mi-chemin n'est jamais pris pour un gabarit complet.
    const building = `${name}_building`
    await client.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${building}" WITH (FORCE)`)
    await client.$executeRawUnsafe(`CREATE DATABASE "${building}"`)
    // Le CLI de Prisma est lancé avec node : le raccourci node_modules/.bin/prisma
    // est un script shell que Windows ne sait pas exécuter directement.
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate', '--accept-data-loss'],
      { env: { ...process.env, DATABASE_URL: urlFor(building), DIRECT_URL: urlFor(building) }, stdio: 'ignore' },
    )
    await client.$executeRawUnsafe(`ALTER DATABASE "${building}" RENAME TO "${name}"`)
    return name
  })
}

/** Crée une base PostgreSQL jetable, clonée du gabarit, isolée par test. */
export async function createTestDb(): Promise<TestDb> {
  const name = `cap_test_${randomBytes(6).toString('hex')}`
  const template = templateName()
  await withAdmin((client) => client.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE "${template}"`))

  const prisma = new PrismaClient({ datasourceUrl: urlFor(name) })
  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect()
      await withAdmin((client) => client.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`))
    },
  }
}
