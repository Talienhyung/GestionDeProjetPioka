import Link from 'next/link'
import type { Difficulty, Phase, TaskStatus } from '@/lib/domain/types'
import { DIFFICULTY_LABELS } from '@/lib/domain/types'
import { PHASE_STYLES, STATUS_LABELS, difficultyMarks } from '@/lib/ui/phases'

interface Props {
  projectId: string
  task: {
    id: string
    title: string
    status: string
    difficulty: string
    phase: string
    assignments: { user: { id: string; displayName: string } }[]
  }
  currentUserId: string
  /** Points de base de la tâche, selon le barème. */
  points?: number
}

export function TaskCard({ projectId, task, currentUserId, points }: Props) {
  const style = PHASE_STYLES[task.phase as Phase]
  const difficulty = task.difficulty as Difficulty
  const status = task.status as TaskStatus
  const mine = task.assignments.some((a) => a.user.id === currentUserId)
  const aPrendre = status === 'OUVERTE'

  return (
    <Link
      href={`/cap/${projectId}/tache/${task.id}`}
      className="flex overflow-hidden rounded-lg border border-trait bg-carte transition-colors hover:border-encre-douce"

    >
      {/* Bande de balise : la couleur de l'étape, comme une marque sur un arbre. */}
      <span aria-hidden className={`w-1.5 shrink-0 ${style.rail}`} />

      <span className="min-w-0 flex-1 p-3">
        <span className="flex items-baseline justify-between gap-2">
          <span className="panneau-titre text-[17px]">{task.title}</span>
          {points !== undefined ? (
            <span className="shrink-0 text-xs tabular-nums text-encre-douce">{points} pts</span>
          ) : null}
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-encre-douce">
          <span className={style.ink} title={DIFFICULTY_LABELS[difficulty]}>
            {difficultyMarks(difficulty)}
          </span>
          <span>{DIFFICULTY_LABELS[difficulty]}</span>
          <span aria-hidden>·</span>
          <span className={aPrendre ? 'font-bold text-accent-encre' : ''}>{STATUS_LABELS[status]}</span>
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {mine ? (
            <span className="panneau rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-sur-accent">
              toi
            </span>
          ) : null}
          {task.assignments.length > 0 ? (
            <span>{task.assignments.map((a) => a.user.displayName).join(', ')}</span>
          ) : (
            <span className="text-encre-douce">personne dessus pour l’instant</span>
          )}
        </span>
      </span>
    </Link>
  )
}
