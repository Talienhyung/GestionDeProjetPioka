/**
 * Prépare la base des tests bout en bout : schéma neuf, amorçage habituel,
 * puis les comptes et le CAP du scénario. Toujours reparti de zéro.
 */
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../../src/lib/auth/password'

const DB_FILE = join(process.cwd(), 'e2e/e2e.db')
const DB_URL = `file:${DB_FILE}`

async function main() {
  rmSync(DB_FILE, { force: true })
  rmSync(join(process.cwd(), 'e2e/uploads'), { recursive: true, force: true })

  const env = { ...process.env, DATABASE_URL: DB_URL }
  execFileSync('node_modules/.bin/prisma', ['db', 'push', '--skip-generate', '--accept-data-loss'], {
    env,
    stdio: 'ignore',
  })
  execFileSync('node_modules/.bin/tsx', ['prisma/seed.ts'], {
    env: { ...env, SUPER_ADMIN_USERNAME: 'admin', SUPER_ADMIN_PASSWORD: 'admin-mdp-2027' },
    stdio: 'ignore',
  })

  const db = new PrismaClient({ datasourceUrl: DB_URL })

  const compte = async (username: string, displayName: string, role: string, motDePasse: string, doitChanger: boolean) =>
    db.user.create({
      data: {
        username,
        displayName,
        role,
        passwordHash: await hashPassword(motDePasse),
        mustChangePassword: doitChanger,
      },
    })

  const sarah = await compte('sarah', 'Sarah', 'CHEF', 'chef-mdp-2027', false)
  await compte('lucie', 'Lucie', 'JEUNE', 'motdepasse-initial', true)
  await compte('tom', 'Tom', 'JEUNE', 'motdepasse-initial', false)

  // Un seul CAP en cours : celui du scénario.
  await db.project.updateMany({ data: { status: 'ARCHIVE', archivedAt: new Date() } })
  const project = await db.project.create({
    data: { title: "Camp d'été 2027", description: 'Le CAP de la caravane', currentPhase: 'AGIR' },
  })

  await db.task.createMany({
    data: [
      {
        projectId: project.id,
        title: 'Établir le budget prévisionnel',
        description: 'Lister toutes les dépenses et toutes les recettes attendues.',
        phase: 'AGIR',
        difficulty: 'DIFFICILE',
        status: 'OUVERTE',
        createdById: sarah.id,
      },
      {
        projectId: project.id,
        title: 'Réserver le lieu',
        description: 'Trouver le lieu, vérifier qu’il convient et le réserver.',
        phase: 'AGIR',
        difficulty: 'MOYEN',
        status: 'OUVERTE',
        createdById: sarah.id,
      },
    ],
  })

  await db.$disconnect()
  console.log('Base e2e prête.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
