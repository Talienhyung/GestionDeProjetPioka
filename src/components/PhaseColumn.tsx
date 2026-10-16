import { TaskCard } from '@/components/TaskCard'
import type { Phase } from '@/lib/domain/types'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

interface Props {
  phase: Phase
  tasks: Parameters<typeof TaskCard>[0]['task'][]
  currentUserId: string
  isCurrentPhase: boolean
  /** Points de base par difficulté, selon le barème. */
  points: Record<string, number>
}

/**
 * Une étape de l'itinéraire. Le fond reste celui de la page : seuls le
 * bandeau et la bande de gauche portent la couleur, ce qui tient aussi
 * bien en thème sombre qu'en clair.
 */
export function PhaseColumn({ phase, tasks, currentUserId, isCurrentPhase, points }: Props) {
  const style = PHASE_STYLES[phase]
  const progress = phaseProgress(tasks)

  return (
    <section>
      <header
        className={`flex items-center gap-2 rounded-t-lg border-x border-t px-3 py-2 ${style.soft} ${style.border}`}
      >
        <span aria-hidden className={`h-5 w-1.5 rounded-full ${style.rail}`} />
        <h2 className={`panneau flex-1 text-base leading-none ${style.ink}`}>{style.label}</h2>
        {isCurrentPhase ? (
          <span className={`panneau rounded-full px-2 py-0.5 text-[10px] ${style.rail} text-carte`}>
            étape en cours
          </span>
        ) : null}
        <span className={`text-xs tabular-nums ${style.ink}`}>
          {progress.done}/{progress.total}
        </span>
      </header>

      <div
        className={`flex flex-col gap-2 rounded-b-lg border-x border-b border-trait bg-surface-haute/40 p-2`}
      >
        {tasks.length === 0 ? (
          <p className="px-1 py-2 text-sm text-encre-douce">Aucune tâche dans cette étape.</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              points={points[task.difficulty]}
            />
          ))
        )}
      </div>
    </section>
  )
}
