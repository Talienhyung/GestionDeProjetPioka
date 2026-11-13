/**
 * Prépare les données des tests bout en bout : fichier neuf, amorçage
 * habituel, puis les comptes et le CAP du scénario. Toujours reparti de zéro.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { FileBackend } from '../../src/lib/data/backend'
import { createDb } from '../../src/lib/data/client'
import { hashPassword } from '../../src/lib/auth/password'

/** Fichier de données dédié aux tests bout en bout (le même que playwright.config.ts). */
const E2E_DATA_FILE = join(process.cwd(), 'e2e/.data/cap.json')

async function main() {
  rmSync(join(process.cwd(), 'e2e/uploads'), { recursive: true, force: true })
  rmSync(join(process.cwd(), 'e2e/.data'), { recursive: true, force: true })

  // tsx est lancé avec node : les raccourcis de node_modules/.bin sont des
  // scripts shell que Windows ne sait pas exécuter directement.
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'], {
    env: {
      ...process.env,
      DATA_FILE: E2E_DATA_FILE,
      DYNAMODB_TABLE: '',
      SUPER_ADMIN_USERNAME: 'admin',
      SUPER_ADMIN_PASSWORD: 'admin-mdp-2027',
    },
    stdio: 'ignore',
  })

  const db = createDb(new FileBackend(E2E_DATA_FILE))

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

  console.log('Données e2e prêtes.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
