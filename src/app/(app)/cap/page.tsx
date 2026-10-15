import { NewTaskForm } from '@/components/NewTaskForm'
import { PhaseColumn } from '@/components/PhaseColumn'
import { ProgressBar } from '@/components/ProgressBar'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES, isChef } from '@/lib/domain/types'
import { listBoard } from '@/lib/services/taskService'
import { getActiveProject } from '@/lib/services/projectService'
import { phaseProgress } from '@/lib/ui/phases'

export default async function CapPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)
  if (!project) {
    return <p className="p-4">Aucun CAP en cours. Un chef doit en démarrer un.</p>
  }

  const board = await listBoard(db, project.id)
  const all = PHASES.flatMap((phase) => board[phase])
  const global = phaseProgress(all)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="mt-1 text-sm opacity-70">
          {global.done} tâches terminées sur {global.total}
        </p>
        <ProgressBar percent={global.percent} className="mt-2" />
      </header>

      <details className="rounded-2xl border p-4">
        <summary className="cursor-pointer font-semibold">
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
        />
      ))}
    </div>
  )
}
