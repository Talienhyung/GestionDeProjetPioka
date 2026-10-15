export const APP_ROLES = ['SUPER_ADMIN', 'CHEF', 'JEUNE'] as const
export type AppRole = (typeof APP_ROLES)[number]

export const PHASES = ['CHOISIR', 'AGIR', 'PARTAGER'] as const
export type Phase = (typeof PHASES)[number]

export const DIFFICULTIES = ['FACILE', 'MOYEN', 'DIFFICILE'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const PROJECT_STATUSES = ['BROUILLON', 'EN_COURS', 'ARCHIVE'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const TASK_STATUSES = [
  'PROPOSEE',
  'REJETEE',
  'OUVERTE',
  'EN_COURS',
  'SOUMISE',
  'A_CORRIGER',
  'TERMINEE',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const REVIEW_DECISIONS = ['ACCEPTEE', 'REFUSEE'] as const
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

export const ROLE_APPLICATION_STATUSES = ['EN_ATTENTE', 'ACCEPTEE', 'REFUSEE'] as const
export type RoleApplicationStatus = (typeof ROLE_APPLICATION_STATUSES)[number]

export const POINTS_REASONS = ['TACHE', 'BONUS', 'ROLE', 'BADGE', 'ANNULATION'] as const
export type PointsReason = (typeof POINTS_REASONS)[number]

export const PHASE_LABELS: Record<Phase, string> = {
  CHOISIR: 'Choisir',
  AGIR: 'Agir',
  PARTAGER: 'Partager',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
}

/** L'acteur courant, tel que les services le reçoivent. */
export interface Actor {
  id: string
  role: AppRole
  displayName: string
}

export function isChef(actor: Actor): boolean {
  return actor.role === 'CHEF' || actor.role === 'SUPER_ADMIN'
}
