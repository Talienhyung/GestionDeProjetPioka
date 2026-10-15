import { PhaseColumn } from '@/components/PhaseColumn'
import { ProgressBar } from '@/components/ProgressBar'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES } from '@/lib/domain/types'
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
