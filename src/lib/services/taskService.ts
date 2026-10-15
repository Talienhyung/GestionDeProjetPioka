import type { Db } from '@/lib/db'
import { type TaskAction, type TaskContext, nextStatus } from '@/lib/domain/tasks'
import type { Actor, Difficulty, Phase, TaskStatus } from '@/lib/domain/types'
import { PHASES, isChef } from '@/lib/domain/types'
import { NotFoundError, ValidationError } from './errors'
import { notify, notifyMany } from './notificationService'

export interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  phase: Phase
  difficulty: Difficulty
  dueDate?: Date | null
}

async function loadTask(db: Db, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: true, assignments: true, _count: { select: { submissions: true } } },
  })
  if (!task) throw new NotFoundError('Tâche')
  return task
}

function contextFor(
  task: Awaited<ReturnType<typeof loadTask>>,
  actor: Actor,
  subjectUserId = actor.id,
): TaskContext {
  return {
    status: task.status as TaskStatus,
    participantCount: task.assignments.length,
    hasSubmission: task._count.submissions > 0,
    projectArchived: task.project.status === 'ARCHIVE',
    isParticipant: task.assignments.some((a) => a.userId === subjectUserId),
    actorRole: actor.role,
  }
}

async function chefIds(db: Db): Promise<string[]> {
  const chefs = await db.user.findMany({
    where: { role: { in: ['CHEF', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  })
  return chefs.map((c) => c.id)
}

export async function createTask(db: Db, actor: Actor, input: CreateTaskInput) {
  if (!input.title.trim()) throw new ValidationError('Le titre de la tâche est obligatoire.')

  const project = await db.project.findUnique({ where: { id: input.projectId } })
  if (!project) throw new NotFoundError('CAP')
  if (project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé, on ne peut plus y ajouter de tâche.')

  const status: TaskStatus = isChef(actor) ? 'OUVERTE' : 'PROPOSEE'

  const task = await db.task.create({
    data: {
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      phase: input.phase,
      difficulty: input.difficulty,
      status,
      createdById: actor.id,
      dueDate: input.dueDate ?? null,
    },
  })

  if (status === 'PROPOSEE') {
    await notifyMany(db, await chefIds(db), {
      type: 'PROPOSITION',
      message: `${actor.displayName} propose la tâche « ${task.title} »`,
      link: '/validation',
    })
  } else {
    const jeunes = await db.user.findMany({ where: { role: 'JEUNE', isActive: true }, select: { id: true } })
    await notifyMany(db, jeunes.map((j) => j.id), {
      type: 'NOUVELLE_TACHE',
      message: `Nouvelle tâche à prendre : « ${task.title} »`,
      link: `/cap/${task.id}`,
    })
  }

  return task
}

async function applyAction(db: Db, task: Awaited<ReturnType<typeof loadTask>>, ctx: TaskContext, action: TaskAction) {
  const status = nextStatus(ctx, action)
  return db.task.update({ where: { id: task.id }, data: { status } })
}

export async function decideProposal(db: Db, actor: Actor, taskId: string, accept: boolean) {
  const task = await loadTask(db, taskId)
  const updated = await applyAction(
    db,
    task,
    contextFor(task, actor),
    accept ? 'ACCEPTER_PROPOSITION' : 'REFUSER_PROPOSITION',
  )

  await notify(db, task.createdById, {
    type: accept ? 'PROPOSITION_ACCEPTEE' : 'PROPOSITION_REFUSEE',
    message: accept
      ? `Ta proposition « ${task.title} » a été acceptée !`
      : `Ta proposition « ${task.title} » n'a pas été retenue.`,
    link: accept ? `/cap/${task.id}` : '/cap',
  })

  return updated
}

export async function joinTask(db: Db, actor: Actor, taskId: string) {
  const task = await loadTask(db, taskId)
  const updated = await applyAction(db, task, contextFor(task, actor), 'S_INSCRIRE')
  await db.taskAssignment.create({ data: { taskId, userId: actor.id } })
  return updated
}

export async function leaveTask(db: Db, actor: Actor, taskId: string) {
  const task = await loadTask(db, taskId)
  const updated = await applyAction(db, task, contextFor(task, actor), 'SE_DESINSCRIRE')
  await db.taskAssignment.deleteMany({ where: { taskId, userId: actor.id } })
  return updated
}

export async function removeParticipant(db: Db, actor: Actor, taskId: string, userId: string) {
  const task = await loadTask(db, taskId)
  const updated = await applyAction(db, task, contextFor(task, actor, userId), 'RETIRER_PARTICIPANT')
  await db.taskAssignment.deleteMany({ where: { taskId, userId } })

  await notify(db, userId, {
    type: 'RETIRE_TACHE',
    message: `Un chef t'a retiré de la tâche « ${task.title} »`,
    link: `/cap/${task.id}`,
  })

  return updated
}

export async function getTaskDetail(db: Db, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      createdBy: { select: { id: true, displayName: true } },
      assignments: { include: { user: { select: { id: true, displayName: true } } } },
      submissions: {
        orderBy: { createdAt: 'asc' },
        include: {
          submittedBy: { select: { displayName: true } },
          reviewedBy: { select: { displayName: true } },
          attachments: true,
        },
      },
    },
  })
  if (!task) throw new NotFoundError('Tâche')
  return task
}

export type BoardColumn = Awaited<ReturnType<typeof listBoard>>[Phase]

export async function listBoard(db: Db, projectId: string) {
  const tasks = await db.task.findMany({
    where: { projectId, status: { notIn: ['PROPOSEE', 'REJETEE'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: { assignments: { include: { user: { select: { id: true, displayName: true } } } } },
  })

  const board = Object.fromEntries(PHASES.map((phase) => [phase, [] as typeof tasks])) as Record<Phase, typeof tasks>
  for (const task of tasks) board[task.phase as Phase].push(task)
  return board
}
