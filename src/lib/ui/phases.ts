import type { Phase, TaskStatus } from '@/lib/domain/types'

export const PHASE_STYLES: Record<Phase, { label: string; emoji: string; bg: string; text: string; ring: string }> = {
  CHOISIR: { label: 'Choisir', emoji: '💡', bg: 'bg-amber-100', text: 'text-amber-900', ring: 'ring-amber-400' },
  AGIR: { label: 'Agir', emoji: '🔨', bg: 'bg-sky-100', text: 'text-sky-900', ring: 'ring-sky-400' },
  PARTAGER: { label: 'Partager', emoji: '🎉', bg: 'bg-fuchsia-100', text: 'text-fuchsia-900', ring: 'ring-fuchsia-400' },
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

export function phaseProgress(tasks: { status: string }[]): { done: number; total: number; percent: number } {
  const total = tasks.length
  const done = tasks.filter((task) => task.status === 'TERMINEE').length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}
