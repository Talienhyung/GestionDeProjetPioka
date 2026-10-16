import { Itineraire } from '@/components/Itineraire'
import { NewTaskForm } from '@/components/NewTaskForm'
import { PhaseColumn } from '@/components/PhaseColumn'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES, isChef, type Phase } from '@/lib/domain/types'
import { getActiveProject } from '@/lib/services/projectService'
import { getScale } from '@/lib/services/settingsService'
import { listBoard } from '@/lib/services/taskService'
import { phaseProgress } from '@/lib/ui/phases'

export default async function CapPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)
  if (!project) {
    return <p className="text-sm text-encre-douce">Aucun CAP en cours. Un chef doit en démarrer un.</p>
  }

  const [board, scale] = await Promise.all([listBoard(db, project.id), getScale(db)])
  const global = phaseProgress(PHASES.flatMap((phase) => board[phase]))

  return (
    <div className="flex flex-col gap-5">
      <header className="courbes overflow-hidden rounded-xl bg-bandeau px-4 py-4 text-sur-bandeau">
        <p className="panneau text-xs opacity-90">Notre itinéraire</p>
        <h1 className="panneau-titre mt-0.5 text-3xl">{project.title}</h1>
        <p className="mt-2 text-sm tabular-nums opacity-90">
          {global.done} tâches franchies sur {global.total}
        </p>
      </header>

      <Itineraire board={board} phaseCourante={project.currentPhase as Phase} />

      <details className="rounded-lg border border-trait bg-carte px-3 py-2">
        <summary className="panneau cursor-pointer text-sm">
          {isChef(user) ? 'Ajouter une tâche' : 'Proposer une tâche'}
        </summary>
        <div className="mt-3">
          <NewTaskForm isChef={isChef(user)} />
        </div>
      </details>

      {PHASES.map((phase) => (
        <PhaseColumn
          key={phase}
          phase={phase}
          tasks={board[phase]}
          currentUserId={user.id}
          isCurrentPhase={project.currentPhase === phase}
          points={scale}
        />
      ))}
    </div>
  )
}
