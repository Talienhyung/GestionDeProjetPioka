import type { PrismaClient } from '@prisma/client'
import type { Db } from '@/lib/db'
import type { Actor, Phase } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'
import { notifyMany } from './notificationService'

export interface CreateProjectInput {
  title: string
  description?: string
  /** Image de couverture déjà enregistrée. */
  coverName?: string | null
}

/**
 * Un CAP naît en brouillon : le chef le prépare — titre, tâches, rôles —
 * à l'abri des regards, puis le lance. Créer un CAP n'en archive aucun
 * autre : la caravane peut en mener plusieurs de front.
 */
export async function createProject(db: Db, actor: Actor, input: CreateProjectInput) {
  if (!isChef(actor)) throw new ForbiddenError()
  if (!input.title.trim()) throw new ValidationError('Le titre du CAP est obligatoire.')

  return db.project.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: 'BROUILLON',
      coverName: input.coverName ?? null,
    },
  })
}

export async function launchProject(db: Db, actor: Actor, projectId: string) {
  if (!isChef(actor)) throw new ForbiddenError()

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new NotFoundError('CAP')
  if (project.status === 'EN_COURS') throw new ValidationError('Ce CAP est déjà lancé.')
  if (project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé.')

  const lance = await db.project.update({
    where: { id: projectId },
    data: { status: 'EN_COURS', startedAt: new Date() },
  })

  const jeunes = await db.user.findMany({ where: { role: 'JEUNE', isActive: true }, select: { id: true } })
  await notifyMany(db, jeunes.map((jeune) => jeune.id), {
    type: 'CAP_LANCE',
    message: `Nouveau CAP lancé : « ${lance.title} »`,
    link: `/cap/${lance.id}`,
  })

  return lance
}

/** Les CAP vivants, du plus récemment lancé au plus ancien. */
export async function listLiveProjects(db: Db) {
  return db.project.findMany({ where: { status: 'EN_COURS' }, orderBy: { startedAt: 'desc' } })
}

export async function listProjects(db: Db) {
  return db.project.findMany({ orderBy: { startedAt: 'desc' } })
}

/**
 * Le CAP demandé, si cet acteur a le droit de le voir. Un brouillon
 * n'existe pas pour un jeune : il reçoit la même réponse que pour un
 * identifiant inventé.
 */
export async function getVisibleProject(db: Db, actor: Actor, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new NotFoundError('CAP')
  if (project.status === 'BROUILLON' && !isChef(actor)) throw new NotFoundError('CAP')
  return project
}

export async function setPhase(db: Db, actor: Actor, projectId: string, phase: Phase) {
  if (!isChef(actor)) throw new ForbiddenError()
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new NotFoundError('CAP')
  if (project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé.')

  return db.project.update({ where: { id: projectId }, data: { currentPhase: phase } })
}

export async function archiveProject(db: Db, actor: Actor, projectId: string) {
  if (!isChef(actor)) throw new ForbiddenError()
  return db.project.update({
    where: { id: projectId },
    data: { status: 'ARCHIVE', archivedAt: new Date() },
  })
}

/** Change (ou retire, avec null) la couverture. Rend l'ancienne, à effacer du stockage. */
export async function setProjectCover(db: Db, actor: Actor, projectId: string, coverName: string | null) {
  if (!isChef(actor)) throw new ForbiddenError()
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new NotFoundError('CAP')
  await db.project.update({ where: { id: projectId }, data: { coverName } })
  return project.coverName && project.coverName !== coverName ? project.coverName : null
}

/** Ce qu'une suppression emporterait : affiché avant de confirmer. */
export async function deletionImpact(db: Db, projectId: string) {
  const [taches, points, roles, billets] = await Promise.all([
    db.task.count({ where: { projectId } }),
    db.pointsEntry.count({ where: { projectId } }),
    db.projectRole.count({ where: { projectId } }),
    db.note.count({ where: { projectId } }),
  ])
  return { taches, points, roles, billets }
}

/**
 * Supprime un CAP pour de bon : tâches, rendus, rôles, billets et points
 * gagnés dedans. Les écussons restent (ils ne pointent plus vers ce CAP).
 * Rend les noms des images à effacer du stockage : couverture et photos des
 * travaux rendus.
 */
export async function deleteProject(db: PrismaClient, actor: Actor, projectId: string): Promise<string[]> {
  if (!isChef(actor)) throw new ForbiddenError()
  return db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundError('CAP')
    const photos = await tx.attachment.findMany({
      where: { submission: { task: { projectId } } },
      select: { storedName: true },
    })
    await tx.project.delete({ where: { id: projectId } })
    return [...(project.coverName ? [project.coverName] : []), ...photos.map((p) => p.storedName)]
  })
}
