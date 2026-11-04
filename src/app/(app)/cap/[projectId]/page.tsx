import { notFound, redirect } from 'next/navigation'
import { EnteteProjet } from '@/components/EnteteProjet'
import { NewTaskForm } from '@/components/NewTaskForm'
import { OngletsProjet } from '@/components/OngletsProjet'
import { PhaseColumn } from '@/components/PhaseColumn'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES, isChef } from '@/lib/domain/types'
import { formatEuros } from '@/lib/domain/money'
import { NotFoundError } from '@/lib/services/errors'
import { totalForProject } from '@/lib/services/extraJobService'
import { getVisibleProject } from '@/lib/services/projectService'
import { getScale } from '@/lib/services/settingsService'
import { listBoard } from '@/lib/services/taskService'
import { phaseProgress } from '@/lib/ui/phases'

export default async function CapPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser()
  const { projectId } = await params

  let project
  try {
    project = await getVisibleProject(db, user, projectId)
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error
    // Compatibilité : les notifications envoyées avant la mise en place des
    // CAP multiples pointaient sur /cap/<tâche>. On redirige vers l'adresse
    // actuelle plutôt que de rendre ces liens morts.
    const task = await db.task.findUnique({ where: { id: projectId }, select: { id: true, projectId: true } })
    if (!task) notFound()
    redirect(`/cap/${task.projectId}/tache/${task.id}`)
  }

  const [board, scale, cagnotte] = await Promise.all([
    listBoard(db, project.id),
    getScale(db),
    totalForProject(db, project.id),
  ])
  const avancement = phaseProgress(PHASES.flatMap((phase) => board[phase]))
  const modifiable = project.status !== 'ARCHIVE'
  const peutAjouter = modifiable && (isChef(user) || project.status === 'EN_COURS')

  return (
    <div className="flex flex-col gap-5">
      <EnteteProjet projet={project} board={board} avancement={avancement} />
      <OngletsProjet projectId={project.id} actif="tableau" />

      <p className="rounded-lg border border-trait bg-carte p-3 text-sm">
        <span className="panneau-titre text-2xl tabular-nums">{formatEuros(cagnotte)}</span>
        <span className="block text-xs text-encre-douce">récoltés en extra jobs pour ce CAP</span>
      </p>

      {peutAjouter ? (
        <details className="rounded-lg border border-trait bg-carte px-3 py-2">
          <summary className="panneau cursor-pointer text-sm">
            {isChef(user) ? 'Ajouter une tâche' : 'Proposer une tâche'}
          </summary>
          <div className="mt-3">
            <NewTaskForm isChef={isChef(user)} projectId={project.id} />
          </div>
        </details>
      ) : null}

      {PHASES.map((phase) => (
        <PhaseColumn
          key={phase}
          phase={phase}
          projectId={project.id}
          tasks={board[phase]}
          currentUserId={user.id}
          isCurrentPhase={project.currentPhase === phase}
          points={scale}
        />
      ))}
    </div>
  )
}
