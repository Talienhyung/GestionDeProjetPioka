import type { Db } from '@/lib/db'
import type { Actor } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

export const TITRE_MAX = 80

export interface ExtraJobInput {
  title: string
  doneOn: Date
  /** Les jeunes qui ont fait l'extra job. */
  workerIds: string[]
  /** Répartition de l'argent gagné entre les CAP, en centimes. */
  shares: { projectId: string; amountCents: number }[]
}

/** Seuls les chefs saisissent l'argent des extra jobs. */
export async function createExtraJob(db: Db, actor: Actor, input: ExtraJobInput) {
  if (!isChef(actor)) throw new ForbiddenError()

  const title = input.title.trim()
  if (!title) throw new ValidationError('Dis quel extra job a été fait : le titre est obligatoire.')
  if (title.length > TITRE_MAX) throw new ValidationError(`Le titre ne peut pas dépasser ${TITRE_MAX} caractères.`)
  if (Number.isNaN(input.doneOn.getTime())) throw new ValidationError('La date de l’extra job est invalide.')

  const workerIds = [...new Set(input.workerIds)]
  if (workerIds.length === 0) throw new ValidationError('Coche au moins un jeune qui a fait l’extra job.')
  const jeunes = await db.user.count({ where: { id: { in: workerIds }, role: 'JEUNE', isActive: true } })
  if (jeunes !== workerIds.length) throw new ValidationError('Seuls des jeunes actifs peuvent être indiqués.')

  if (input.shares.length === 0) throw new ValidationError('Indique pour quel CAP l’argent a été récolté.')
  const projectIds = input.shares.map((share) => share.projectId)
  if (new Set(projectIds).size !== projectIds.length) {
    throw new ValidationError('Un même CAP apparaît deux fois : additionne ses montants.')
  }
  if (input.shares.some((share) => !Number.isInteger(share.amountCents) || share.amountCents <= 0)) {
    throw new ValidationError('Chaque montant doit être supérieur à zéro.')
  }
  const projets = await db.project.findMany({ where: { id: { in: projectIds } } })
  if (projets.length !== projectIds.length) throw new NotFoundError('CAP')
  if (projets.some((projet) => projet.status === 'ARCHIVE')) {
    throw new ValidationError('Un CAP archivé ne reçoit plus d’argent.')
  }

  return db.extraJob.create({
    data: {
      title,
      doneOn: input.doneOn,
      createdById: actor.id,
      workers: { create: workerIds.map((userId) => ({ userId })) },
      shares: { create: input.shares.map(({ projectId, amountCents }) => ({ projectId, amountCents })) },
    },
  })
}

export async function deleteExtraJob(db: Db, actor: Actor, extraJobId: string) {
  if (!isChef(actor)) throw new ForbiddenError()
  const job = await db.extraJob.findUnique({ where: { id: extraJobId } })
  if (!job) throw new NotFoundError('Extra job')
  await db.extraJob.delete({ where: { id: extraJobId } })
}

export async function listExtraJobs(db: Db) {
  return db.extraJob.findMany({
    orderBy: [{ doneOn: 'desc' }, { createdAt: 'desc' }],
    include: {
      workers: { include: { user: { select: { id: true, displayName: true } } } },
      shares: { include: { project: { select: { id: true, title: true, status: true } } } },
    },
  })
}

/** Total récolté, en centimes, sur les CAP non archivés que l'acteur voit. */
export async function totalCollected(db: Db, actor: Actor) {
  const result = await db.extraJobShare.aggregate({
    _sum: { amountCents: true },
    where: {
      project: { status: isChef(actor) ? { not: 'ARCHIVE' } : 'EN_COURS' },
    },
  })
  return result._sum.amountCents ?? 0
}

/** Total récolté pour un CAP, en centimes. */
export async function totalForProject(db: Db, projectId: string) {
  const result = await db.extraJobShare.aggregate({ _sum: { amountCents: true }, where: { projectId } })
  return result._sum.amountCents ?? 0
}
