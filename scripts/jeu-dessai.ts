/**
 * Jeu d'essai pour un test manuel en local : comptes, CAP, tâches, rôles.
 * À lancer avec `npx tsx scripts/jeu-dessai.ts`. Ne sert qu'au développement.
 */
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'

const db = new PrismaClient()

async function compte(username: string, displayName: string, role: string, motDePasse: string) {
  const passwordHash = await hashPassword(motDePasse)
  return db.user.upsert({
    where: { username },
    update: { passwordHash, mustChangePassword: false, isActive: true, displayName, role },
    create: { username, displayName, role, passwordHash, mustChangePassword: false },
  })
}

async function main() {
  await compte('admin', 'Super admin', 'SUPER_ADMIN', 'admin2027')
  const sarah = await compte('sarah', 'Sarah', 'CHEF', 'chef2027')
  const lucie = await compte('lucie', 'Lucie', 'JEUNE', 'jeune2027')
  await compte('tom', 'Tom', 'JEUNE', 'jeune2027')
  await compte('nina', 'Nina', 'JEUNE', 'jeune2027')

  // Les CAP déjà en base deviennent des archives, renommées pour qu'on ne les
  // confonde pas avec ceux que l'on recrée juste après.
  for (const ancien of await db.project.findMany()) {
    await db.project.update({
      where: { id: ancien.id },
      data: {
        status: 'ARCHIVE',
        archivedAt: new Date(),
        title: ancien.title.endsWith('(ancien)') ? ancien.title : `${ancien.title} (ancien)`,
      },
    })
  }

  const project = await db.project.create({
    data: {
      title: "Camp d'été 2027",
      description: 'Deux semaines en Ardèche.',
      currentPhase: 'AGIR',
      status: 'EN_COURS',
    },
  })

  // Un second CAP mené de front, et un brouillon en préparation.
  const solidarite = await db.project.create({
    data: {
      title: 'Action solidarité hiver',
      description: 'Collecte pour la maraude de décembre.',
      currentPhase: 'CHOISIR',
      status: 'EN_COURS',
    },
  })
  await db.project.create({
    data: { title: 'Week-end de Toussaint', currentPhase: 'CHOISIR', status: 'BROUILLON' },
  })

  const taches = [
    ['Recueillir les idées de chacun', 'CHOISIR', 'FACILE', 'TERMINEE'],
    ['Organiser le vote du projet', 'CHOISIR', 'FACILE', 'OUVERTE'],
    ['Établir le budget prévisionnel', 'AGIR', 'DIFFICILE', 'OUVERTE'],
    ['Réserver le lieu', 'AGIR', 'MOYEN', 'OUVERTE'],
    ['Contacter les partenaires', 'AGIR', 'MOYEN', 'OUVERTE'],
    ['Préparer la veillée de partage', 'PARTAGER', 'MOYEN', 'OUVERTE'],
  ] as const

  for (const [title, phase, difficulty, status] of taches) {
    const task = await db.task.create({
      data: { projectId: project.id, title, phase, difficulty, status, createdById: sarah.id },
    })

    if (status === 'TERMINEE') {
      await db.taskAssignment.create({ data: { taskId: task.id, userId: lucie.id } })
      await db.submission.create({
        data: {
          taskId: task.id,
          submittedById: lucie.id,
          message: 'Toutes les idées de l’équipe sont notées.',
          decision: 'ACCEPTEE',
          reviewedById: sarah.id,
          reviewedAt: new Date(),
          reviewComment: 'Très clair, bravo.',
        },
      })
      await db.pointsEntry.create({
        data: { userId: lucie.id, projectId: project.id, amount: 10, reason: 'TACHE', taskId: task.id },
      })
    }
  }

  for (const [name, points] of [['Trésorier', 60], ['Intendant', 50], ['Responsable communication', 50]] as const) {
    await db.projectRole.create({ data: { projectId: project.id, name, points } })
  }

  for (const [title, phase, difficulty] of [
    ['Recueillir les idées de collecte', 'CHOISIR', 'FACILE'],
    ['Contacter la maraude', 'CHOISIR', 'MOYEN'],
    ['Organiser la collecte', 'AGIR', 'DIFFICILE'],
  ] as const) {
    await db.task.create({
      data: { projectId: solidarite.id, title, phase, difficulty, status: 'OUVERTE', createdById: sarah.id },
    })
  }
  await db.projectRole.create({
    data: { projectId: solidarite.id, name: 'Responsable collecte', points: 40 },
  })

  console.log('Jeu d’essai prêt.')
  await db.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
