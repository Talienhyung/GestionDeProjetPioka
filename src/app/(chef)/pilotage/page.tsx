import Link from 'next/link'
import { ActionButton } from '@/components/ActionButton'
import { NewProjectForm } from '@/components/NewProjectForm'
import { ProgressBar } from '@/components/ProgressBar'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES, type Phase } from '@/lib/domain/types'
import { getActiveProject, listProjects } from '@/lib/services/projectService'
import { listBoard } from '@/lib/services/taskService'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'
import { archiveAction, setPhaseAction } from './actions'

export default async function PilotagePage() {
  await requireChef()
  const [project, projets] = await Promise.all([getActiveProject(db), listProjects(db)])
  const board = project ? await listBoard(db, project.id) : null
  const progress = board ? phaseProgress(PHASES.flatMap((phase) => board[phase])) : null
  const archives = projets.filter((autre) => autre.status === 'ARCHIVE')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="panneau-titre text-3xl">Pilotage du CAP</h1>

      {project ? (
        <section className="rounded-xl border border-trait p-4">
          <h2 className="panneau-titre text-lg">{project.title}</h2>
          {progress ? (
            <>
              <p className="mt-1 text-sm text-encre-douce">{progress.done} tâches terminées sur {progress.total}</p>
              <ProgressBar percent={progress.percent} className="mt-2" />
            </>
          ) : null}

          <h3 className="mt-4 font-semibold">Phase en cours</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {PHASES.map((phase) => {
              const style = PHASE_STYLES[phase as Phase]
              const courante = project.currentPhase === phase
              return (
                <ActionButton
                  key={phase}
                  action={setPhaseAction.bind(null, phase)}
                  className={`panneau rounded-lg border border-trait px-4 py-2 text-sm ${style.soft} ${style.ink} ${
                    courante ? style.border : 'border-transparent'
                  }`}
                >
                  {style.label}{courante ? ' ✓' : ''}
                </ActionButton>
              )
            })}
          </div>

          <div className="mt-4">
            <ActionButton
              action={archiveAction}
              className="rounded-lg border border-trait px-4 py-2 text-sm"
              confirm="Archiver ce CAP ? Il deviendra consultable mais plus modifiable."
            >
              Archiver ce CAP
            </ActionButton>
          </div>
        </section>
      ) : (
        <p className="text-sm text-encre-douce">Aucun CAP en cours.</p>
      )}

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Démarrer un nouveau CAP</h2>
        <NewProjectForm archiveraLeCourant={project !== null} />
      </section>

      {archives.length > 0 ? (
        <section>
          <h2 className="panneau-titre mb-2 text-lg">CAP archivés</h2>
          <ul className="flex flex-col gap-2">
            {archives.map((archive) => (
              <li key={archive.id}>
                <Link href={`/archives/${archive.id}`} className="block rounded-xl border border-trait p-3 text-sm">
                  <strong>{archive.title}</strong>
                  <span className="block text-encre-douce">
                    archivé le {archive.archivedAt?.toLocaleDateString('fr-FR')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
