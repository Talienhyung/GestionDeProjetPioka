// src/lib/domain/tasks.ts
import type { AppRole, TaskStatus } from './types'

export const TASK_ACTIONS = [
  'ACCEPTER_PROPOSITION',
  'REFUSER_PROPOSITION',
  'S_INSCRIRE',
  'SE_DESINSCRIRE',
  'RETIRER_PARTICIPANT',
  'SOUMETTRE',
  'VALIDER',
  'REFUSER',
  'ANNULER_VALIDATION',
] as const
export type TaskAction = (typeof TASK_ACTIONS)[number]

export interface TaskContext {
  status: TaskStatus
  /** Participants inscrits AVANT l'action. */
  participantCount: number
  /** Au moins une soumission a déjà été faite sur cette tâche. */
  hasSubmission: boolean
  projectArchived: boolean
  /** L'acteur est inscrit sur la tâche. */
  isParticipant: boolean
  actorRole: AppRole
}

export class TaskTransitionError extends Error {
  constructor(status: TaskStatus, action: TaskAction, reason: string) {
    super(`Action « ${action} » impossible sur une tâche ${status} : ${reason}`)
    this.name = 'TaskTransitionError'
  }
}

const CHEF_ACTIONS: TaskAction[] = [
  'ACCEPTER_PROPOSITION',
  'REFUSER_PROPOSITION',
  'RETIRER_PARTICIPANT',
  'VALIDER',
  'REFUSER',
  'ANNULER_VALIDATION',
]

function actorIsChef(ctx: TaskContext): boolean {
  return ctx.actorRole === 'CHEF' || ctx.actorRole === 'SUPER_ADMIN'
}

/** Rend le statut résultant, ou null si l'action est interdite dans ce contexte. */
function resolve(ctx: TaskContext, action: TaskAction): TaskStatus | null {
  if (ctx.projectArchived) return null
  if (CHEF_ACTIONS.includes(action) && !actorIsChef(ctx)) return null

  switch (action) {
    case 'ACCEPTER_PROPOSITION':
      return ctx.status === 'PROPOSEE' ? 'OUVERTE' : null

    case 'REFUSER_PROPOSITION':
      return ctx.status === 'PROPOSEE' ? 'REJETEE' : null

    case 'S_INSCRIRE':
      if (ctx.isParticipant) return null
      return ['OUVERTE', 'EN_COURS', 'A_CORRIGER'].includes(ctx.status) ? ctx.status === 'OUVERTE' ? 'EN_COURS' : ctx.status : null

    case 'SE_DESINSCRIRE':
      if (!ctx.isParticipant || ctx.hasSubmission) return null
      if (!['EN_COURS', 'OUVERTE'].includes(ctx.status)) return null
      return ctx.participantCount <= 1 ? 'OUVERTE' : 'EN_COURS'

    case 'RETIRER_PARTICIPANT':
      if (ctx.status === 'TERMINEE' || ctx.participantCount < 1) return null
      if (!ctx.hasSubmission && ctx.participantCount <= 1) return 'OUVERTE'
      return ctx.status

    case 'SOUMETTRE':
      if (!ctx.isParticipant) return null
      return ['EN_COURS', 'A_CORRIGER'].includes(ctx.status) ? 'SOUMISE' : null

    case 'VALIDER':
      return ctx.status === 'SOUMISE' ? 'TERMINEE' : null

    case 'REFUSER':
      return ctx.status === 'SOUMISE' ? 'A_CORRIGER' : null

    case 'ANNULER_VALIDATION':
      return ctx.status === 'TERMINEE' ? 'A_CORRIGER' : null
  }
}

export function canPerform(ctx: TaskContext, action: TaskAction): boolean {
  return resolve(ctx, action) !== null
}

export function nextStatus(ctx: TaskContext, action: TaskAction): TaskStatus {
  const result = resolve(ctx, action)
  if (result === null) {
    const reason = ctx.projectArchived
      ? 'le CAP est archivé'
      : CHEF_ACTIONS.includes(action) && !actorIsChef(ctx)
        ? 'réservé aux chefs'
        : 'transition non autorisée'
    throw new TaskTransitionError(ctx.status, action, reason)
  }
  return result
}
