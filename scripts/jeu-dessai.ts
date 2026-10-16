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

  await db.project.updateMany({ data: { status: 'ARCHIVE', archivedAt: new Date() } })
  const project = await db.project.create({
    data: { title: "Camp d'été 2027", description: 'Deux semaines en Ardèche.', currentPhase: 'AGIR' },
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

  console.log('Jeu d’essai prêt.')
  await db.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
