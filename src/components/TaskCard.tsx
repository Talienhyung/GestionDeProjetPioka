import Link from 'next/link'
import { Icone } from '@/components/Icone'
import type { Difficulty, TaskStatus } from '@/lib/domain/types'
import { DIFFICULTY_LABELS } from '@/lib/domain/types'
import { STATUS_LABELS, difficultyMarks } from '@/lib/ui/phases'

/** Libellés courts pour la pastille : elle tient sur une ligne, à côté du titre. */
const COURT: Partial<Record<TaskStatus, string>> = { SOUMISE: 'À valider' }

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

/** Pastille d'état : la couleur dit d'un coup d'œil s'il y a quelque chose à faire. */
const PASTILLE: Record<TaskStatus, string> = {
  OUVERTE: 'bg-accent-doux text-accent-encre',
  A_CORRIGER: 'bg-alerte-doux text-alerte',
  EN_COURS: 'bg-surface-haute text-encre',
  SOUMISE: 'bg-partager-doux text-partager-encre',
  PROPOSEE: 'bg-choisir-doux text-choisir-encre',
  TERMINEE: 'bg-ok-doux text-ok',
  REJETEE: 'bg-surface-haute text-encre-douce',
}

/** Une tâche sur une ligne : titre, état, difficulté, points, qui. Un appui ouvre la tâche. */
export function TaskCard({ projectId, task, currentUserId, points }: Props) {
  const difficulty = task.difficulty as Difficulty
  const status = task.status as TaskStatus
  const terminee = status === 'TERMINEE'
  const qui = task.assignments.map((a) => (a.user.id === currentUserId ? 'toi' : a.user.displayName))

  return (
    <Link
      href={`/cap/${projectId}/tache/${task.id}`}
      className={`flex items-center gap-3 rounded-xl border bg-carte p-3 transition-colors active:bg-surface-haute ${
        'border-trait hover:border-encre-douce'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block leading-snug font-bold ${terminee ? 'text-encre-douce line-through decoration-1' : ''}`}>
          {task.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-encre-douce">
          <span title={DIFFICULTY_LABELS[difficulty]} aria-label={DIFFICULTY_LABELS[difficulty]}>
            {difficultyMarks(difficulty)}
          </span>
          {points !== undefined ? <span className="tabular-nums">· {points} pts</span> : null}
          {qui.length > 0 ? <span className="truncate">· {qui.join(', ')}</span> : null}
        </span>
      </span>

      <span className={`panneau shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] ${PASTILLE[status]}`}>
        {COURT[status] ?? STATUS_LABELS[status]}
      </span>
      <Icone nom="chevron" taille={16} className="-mr-1 shrink-0 text-encre-douce" />
    </Link>
  )
}
