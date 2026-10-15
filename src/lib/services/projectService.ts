import type { Db } from '@/lib/db'
import type { Actor, Phase } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

export interface CreateProjectInput {
  title: string
  description?: string
}

export async function createProject(db: Db, actor: Actor, input: CreateProjectInput) {
  if (!isChef(actor)) throw new ForbiddenError()
  if (!input.title.trim()) throw new ValidationError('Le titre du CAP est obligatoire.')

  return db.project.create({
    data: { title: input.title.trim(), description: input.description?.trim() ?? '', status: 'EN_COURS' },
  })
}

/** Le CAP en cours. Il n'y en a qu'un à la fois : le plus récemment démarré. */
export async function getActiveProject(db: Db) {
  return db.project.findFirst({ where: { status: 'EN_COURS' }, orderBy: { startedAt: 'desc' } })
}

export async function listProjects(db: Db) {
  return db.project.findMany({ orderBy: { startedAt: 'desc' } })
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
