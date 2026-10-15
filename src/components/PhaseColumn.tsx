// src/components/PhaseColumn.tsx
import { TaskCard } from '@/components/TaskCard'
import { ProgressBar } from '@/components/ProgressBar'
import type { Phase } from '@/lib/domain/types'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

interface Props {
  phase: Phase
  tasks: Parameters<typeof TaskCard>[0]['task'][]
  currentUserId: string
  isCurrentPhase: boolean
}

export function PhaseColumn({ phase, tasks, currentUserId, isCurrentPhase }: Props) {
  const style = PHASE_STYLES[phase]
  const progress = phaseProgress(tasks)

  return (
    <section className={`rounded-2xl p-4 ${style.bg} ${style.text} ${isCurrentPhase ? `ring-2 ${style.ring}` : ''}`}>
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">
          <span aria-hidden>{style.emoji}</span> {style.label}
        </h2>
        <span className="text-sm">{progress.done}/{progress.total}</span>
      </header>
      <ProgressBar percent={progress.percent} className="my-3" />

      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-sm opacity-70">Aucune tâche dans cette phase pour l’instant.</p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} currentUserId={currentUserId} />)
        )}
      </div>
    </section>
  )
}
