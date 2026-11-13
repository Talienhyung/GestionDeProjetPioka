/**
 * Prépare la base des tests bout en bout : schéma neuf, amorçage habituel,
 * puis les comptes et le CAP du scénario. Toujours reparti de zéro.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../../src/lib/auth/password'

/** Base dédiée aux tests bout en bout, sur le serveur PostgreSQL de dev. */
const DB_URL = (() => {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://cap:cap@localhost:5432/cap')
  url.pathname = '/cap_e2e'
  return url.toString()
})()

async function main() {
  rmSync(join(process.cwd(), 'e2e/uploads'), { recursive: true, force: true })

  // Repartir de zéro : la base e2e est supprimée puis recréée.
  const adminUrl = new URL(DB_URL)
  adminUrl.pathname = '/postgres'
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() })
  await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS "cap_e2e" WITH (FORCE)')
  await admin.$executeRawUnsafe('CREATE DATABASE "cap_e2e"')
  await admin.$disconnect()

  const env = { ...process.env, DATABASE_URL: DB_URL, DIRECT_URL: DB_URL }
  // Les CLI sont lancés avec node : les raccourcis de node_modules/.bin sont
  // des scripts shell que Windows ne sait pas exécuter directement.
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    env,
    stdio: 'ignore',
  })
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'], {
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
  await compte('nina', 'Nina', 'JEUNE', 'motdepasse-initial', false)

  // Un seul CAP en cours : celui du scénario.
  await db.project.updateMany({ data: { status: 'ARCHIVE', archivedAt: new Date() } })
  const project = await db.project.create({
    data: {
      title: "Camp d'été 2027",
      description: 'Le CAP de la caravane',
      currentPhase: 'AGIR',
      status: 'EN_COURS',
    },
  })

  // Un brouillon, que les jeunes ne doivent pas voir.
  await db.project.create({
    data: { title: 'Week-end de Toussaint', status: 'BROUILLON', currentPhase: 'CHOISIR' },
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

  // Photo de test, pour le parcours « je rends mon travail avec une photo ».
  mkdirSync(join(process.cwd(), 'e2e/fixtures'), { recursive: true })
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#2b7a4b' } })
    .jpeg()
    .toFile(join(process.cwd(), 'e2e/fixtures/photo.jpg'))

  await db.$disconnect()
  console.log('Base e2e prête.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
