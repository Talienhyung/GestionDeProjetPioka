import type { Db } from '@/lib/db'
import type { Actor, Phase } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'
import { notifyMany } from './notificationService'

export interface CreateProjectInput {
  title: string
  description?: string
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
