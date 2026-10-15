import type { PrismaClient } from '@prisma/client'
import { computeTaskAward } from '@/lib/domain/points'
import { nextStatus, type TaskContext } from '@/lib/domain/tasks'
import { MAX_PHOTOS_PER_SUBMISSION, UploadError } from '@/lib/domain/uploads'
import type { Actor, Difficulty, ReviewDecision, TaskStatus } from '@/lib/domain/types'
import { deletePhoto, storePhoto, type StoredPhoto } from '@/lib/storage'
import { refreshBadges } from './badgeService'
import { NotFoundError, ValidationError } from './errors'
import { notify, notifyMany } from './notificationService'
import { creditPoints } from './pointsService'
import { getScale } from './settingsService'

export interface SubmitInput {
  taskId: string
  message: string
  photos: { buffer: Buffer; originalName: string }[]
}

export interface ReviewInput {
  submissionId: string
  decision: ReviewDecision
  comment?: string
  bonus?: number
}

export interface ReviewResult {
  taskStatus: TaskStatus
  awarded: { userId: string; amount: number }[]
  newBadges: { userId: string; codes: string[] }[]
}

export class AlreadyReviewedError extends Error {
  constructor() {
    super('Cette soumission a déjà été traitée par un chef.')
    this.name = 'AlreadyReviewedError'
  }
}

async function chefIds(db: PrismaClient): Promise<string[]> {
  const chefs = await db.user.findMany({
    where: { role: { in: ['CHEF', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  })
  return chefs.map((c) => c.id)
}

export async function submitTask(db: PrismaClient, actor: Actor, input: SubmitInput): Promise<{ submissionId: string }> {
  if (input.photos.length > MAX_PHOTOS_PER_SUBMISSION) {
    throw new UploadError(`Une soumission accepte au maximum ${MAX_PHOTOS_PER_SUBMISSION} photos.`)
  }

  const task = await db.task.findUnique({
    where: { id: input.taskId },
    include: { project: true, assignments: true, _count: { select: { submissions: true } } },
  })
  if (!task) throw new NotFoundError('Tâche')

  const ctx: TaskContext = {
    status: task.status as TaskStatus,
    participantCount: task.assignments.length,
    hasSubmission: task._count.submissions > 0,
    projectArchived: task.project.status === 'ARCHIVE',
    isParticipant: task.assignments.some((a) => a.userId === actor.id),
    actorRole: actor.role,
  }
  const status = nextStatus(ctx, 'SOUMETTRE')

  // Les photos sont écrites avant la transaction ; si celle-ci échoue, on les retire.
  const stored: StoredPhoto[] = []
  try {
    for (const photo of input.photos) {
      stored.push(await storePhoto(photo.buffer, photo.originalName))
    }

    const submission = await db.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: { taskId: task.id, submittedById: actor.id, message: input.message.trim() },
      })
      if (stored.length > 0) {
        await tx.attachment.createMany({
          data: stored.map((photo) => ({ ...photo, submissionId: created.id, uploadedById: actor.id })),
        })
      }
      await tx.task.update({ where: { id: task.id }, data: { status } })
      return created
    })

    await notifyMany(db, await chefIds(db), {
      type: 'SOUMISSION',
      message: `${actor.displayName} a rendu « ${task.title} »`,
      link: '/validation',
    })

    return { submissionId: submission.id }
  } catch (error) {
    await Promise.all(stored.map((photo) => deletePhoto(photo.storedName)))
    throw error
  }
}

export async function reviewSubmission(db: PrismaClient, actor: Actor, input: ReviewInput): Promise<ReviewResult> {
  const scale = await getScale(db)

  const { taskStatus, awarded, projectId, taskTitle, participantIds } = await db.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({
      where: { id: input.submissionId },
      include: { task: { include: { project: true, assignments: true, _count: { select: { submissions: true } } } } },
    })
    if (!submission) throw new NotFoundError('Soumission')
    // Verrou logique : une soumission déjà tranchée ne repasse jamais ici.
    if (submission.decision) throw new AlreadyReviewedError()

    const task = submission.task
    const ctx: TaskContext = {
      status: task.status as TaskStatus,
      participantCount: task.assignments.length,
      hasSubmission: task._count.submissions > 0,
      projectArchived: task.project.status === 'ARCHIVE',
      isParticipant: task.assignments.some((a) => a.userId === actor.id),
      actorRole: actor.role,
    }

    const accepted = input.decision === 'ACCEPTEE'
    const status = nextStatus(ctx, accepted ? 'VALIDER' : 'REFUSER')

    const comment = input.comment?.trim() ?? ''
    if (!accepted && comment.length === 0) {
      throw new ValidationError('Un refus doit être accompagné d\'un commentaire pour le jeune.')
    }

    const participants = task.assignments.map((a) => a.userId)
    const bonus = Math.max(0, Math.round(input.bonus ?? 0))
    const results: { userId: string; amount: number }[] = []

    if (accepted) {
      if (participants.length === 0) {
        throw new ValidationError('Cette tâche n\'a plus aucun participant : impossible d\'attribuer des points.')
      }
      const amount = computeTaskAward(task.difficulty as Difficulty, participants.length, bonus, scale)
      for (const userId of participants) {
        await creditPoints(tx, {
          userId,
          projectId: task.projectId,
          amount,
          reason: 'TACHE',
          taskId: task.id,
          submissionId: submission.id,
        })
        results.push({ userId, amount })
      }
    }

    await tx.submission.update({
      where: { id: submission.id },
      data: {
        decision: input.decision,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewComment: comment,
        bonusPoints: accepted ? bonus : 0,
      },
    })
    await tx.task.update({ where: { id: task.id }, data: { status } })

    return {
      taskStatus: status,
      awarded: results,
      projectId: task.projectId,
      taskTitle: task.title,
      participantIds: participants,
    }
  })

  const accepted = input.decision === 'ACCEPTEE'
  await notifyMany(db, participantIds, {
    type: accepted ? 'TACHE_VALIDEE' : 'TACHE_REFUSEE',
    message: accepted
      ? `« ${taskTitle} » est validée, bravo !`
      : `« ${taskTitle} » est à corriger : ${input.comment?.trim()}`,
    link: `/cap/${(await db.submission.findUniqueOrThrow({ where: { id: input.submissionId } })).taskId}`,
  })

  // Les badges s'évaluent une fois la transaction validée, sur des données à jour.
  const newBadges: { userId: string; codes: string[] }[] = []
  if (accepted) {
    for (const userId of participantIds) {
      newBadges.push({ userId, codes: await refreshBadges(db, userId, projectId) })
    }
  }

  return { taskStatus, awarded, newBadges }
}

/** Annule la dernière validation d'une tâche : les points de la tâche sont repris. */
export async function cancelValidation(db: PrismaClient, actor: Actor, taskId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: { project: true, assignments: true, _count: { select: { submissions: true } } },
    })
    if (!task) throw new NotFoundError('Tâche')

    const ctx: TaskContext = {
      status: task.status as TaskStatus,
      participantCount: task.assignments.length,
      hasSubmission: task._count.submissions > 0,
      projectArchived: task.project.status === 'ARCHIVE',
      isParticipant: false,
      actorRole: actor.role,
    }
    const status = nextStatus(ctx, 'ANNULER_VALIDATION')

    const entries = await tx.pointsEntry.findMany({ where: { taskId, reason: 'TACHE' } })
    for (const entry of entries) {
      await tx.pointsEntry.create({
        data: {
          userId: entry.userId,
          projectId: entry.projectId,
          amount: -entry.amount,
          reason: 'ANNULATION',
          taskId,
        },
      })
    }

    await tx.task.update({ where: { id: taskId }, data: { status } })
  })

  await notify(db, actor.id, {
    type: 'VALIDATION_ANNULEE',
    message: 'Validation annulée.',
    link: `/cap/${taskId}`,
  })
}

export async function listPendingSubmissions(db: PrismaClient) {
  return db.submission.findMany({
    where: { decision: null },
    orderBy: { createdAt: 'asc' },
    include: {
      submittedBy: { select: { displayName: true } },
      attachments: true,
      task: { include: { assignments: { include: { user: { select: { displayName: true } } } } } },
    },
  })
}
