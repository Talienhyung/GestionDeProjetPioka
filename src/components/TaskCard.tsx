// src/components/TaskCard.tsx
import Link from 'next/link'
import type { Difficulty, TaskStatus } from '@/lib/domain/types'
import { DIFFICULTY_LABELS } from '@/lib/domain/types'
import { STATUS_LABELS } from '@/lib/ui/phases'

interface Props {
  task: {
    id: string
    title: string
    status: string
    difficulty: string
    assignments: { user: { id: string; displayName: string } }[]
  }
  currentUserId: string
}

export function TaskCard({ task, currentUserId }: Props) {
  const mine = task.assignments.some((a) => a.user.id === currentUserId)

  return (
    <Link
      href={`/cap/${task.id}`}
      className={`block rounded-xl border bg-white p-3 shadow-sm dark:bg-stone-900 ${mine ? 'ring-2 ring-emerald-400' : ''}`}
    >
      <p className="font-semibold">{task.title}</p>
      <p className="mt-1 text-xs opacity-70">
        {DIFFICULTY_LABELS[task.difficulty as Difficulty]} · {STATUS_LABELS[task.status as TaskStatus]}
      </p>
      {task.assignments.length > 0 ? (
        <p className="mt-2 text-xs">
          {task.assignments.map((a) => a.user.displayName).join(', ')}
        </p>
      ) : (
        <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">Personne dessus pour l'instant</p>
      )}
    </Link>
  )
}
