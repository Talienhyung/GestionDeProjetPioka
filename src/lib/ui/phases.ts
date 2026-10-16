import type { Difficulty, Phase, TaskStatus } from '@/lib/domain/types'

export interface PhaseStyle {
  label: string
  /** Bande de balise, pleine couleur. */
  rail: string
  /** Texte sur fond de page ou sur fond doux. */
  ink: string
  /** Fond teinté léger, pour un bandeau ou une puce. */
  soft: string
  border: string
}

/**
 * Une teinte par étape, reprise du balisage de randonnée. Uniquement des
 * jetons du thème : une classe brute (bg-amber-100) n'aurait pas de
 * contrepartie en sombre.
 */
export const PHASE_STYLES: Record<Phase, PhaseStyle> = {
  CHOISIR: {
    label: 'Choisir',
    rail: 'bg-choisir',
    ink: 'text-choisir-encre',
    soft: 'bg-choisir-doux',
    border: 'border-choisir',
  },
  AGIR: {
    label: 'Agir',
    rail: 'bg-agir',
    ink: 'text-agir-encre',
    soft: 'bg-agir-doux',
    border: 'border-agir',
  },
  PARTAGER: {
    label: 'Partager',
    rail: 'bg-partager',
    ink: 'text-partager-encre',
    soft: 'bg-partager-doux',
    border: 'border-partager',
  },
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  PROPOSEE: 'Proposée',
  REJETEE: 'Non retenue',
  OUVERTE: 'À prendre',
  EN_COURS: 'En cours',
  SOUMISE: 'En attente de validation',
  A_CORRIGER: 'À corriger',
  TERMINEE: 'Terminée',
}

/** Difficulté lue d'un coup d'œil, comme la cotation d'un sentier. */
export const DIFFICULTY_MARKS: Record<Difficulty, string> = {
  FACILE: '●○○',
  MOYEN: '●●○',
  DIFFICILE: '●●●',
}

export function difficultyMarks(difficulty: Difficulty): string {
  return DIFFICULTY_MARKS[difficulty]
}

export function phaseProgress(tasks: { status: string }[]): { done: number; total: number; percent: number } {
  const total = tasks.length
  const done = tasks.filter((task) => task.status === 'TERMINEE').length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}
