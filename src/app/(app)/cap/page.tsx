import Link from 'next/link'
import { ProgressBar } from '@/components/ProgressBar'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES, isChef, type Phase } from '@/lib/domain/types'
import { listProjects } from '@/lib/services/projectService'
import { listBoard } from '@/lib/services/taskService'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

/** Les CAP de la caravane : ceux qui tournent, les brouillons, les précédents. */
export default async function MesCapPage() {
  const user = await requireUser()
  const chef = isChef(user)
  const projets = await listProjects(db)

  const vivants = projets.filter((projet) => projet.status === 'EN_COURS')
  const brouillons = chef ? projets.filter((projet) => projet.status === 'BROUILLON') : []
  const archives = projets.filter((projet) => projet.status === 'ARCHIVE')

  const progression = Object.fromEntries(
    await Promise.all(
      projets.map(async (projet) => {
        const board = await listBoard(db, projet.id)
        return [projet.id, phaseProgress(PHASES.flatMap((phase) => board[phase]))] as const
      }),
    ),
  )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="panneau-titre text-3xl">Nos CAP</h1>

      <section className="flex flex-col gap-2">
        <h2 className="panneau text-sm text-encre-douce">En cours</h2>

        {vivants.length === 0 ? (
          <p className="text-sm text-encre-douce">
            Aucun CAP en cours{chef ? ' : lance un brouillon depuis le pilotage.' : ' pour l’instant.'}
          </p>
        ) : (
          vivants.map((projet) => {
            const avancement = progression[projet.id]
            const style = PHASE_STYLES[projet.currentPhase as Phase]

            return (
              <Link
                key={projet.id}
                href={`/cap/${projet.id}`}
                className="flex overflow-hidden rounded-lg border border-trait bg-carte hover:border-encre-douce"
              >
                <span aria-hidden className={`w-1.5 shrink-0 ${style.rail}`} />
                <span className="flex-1 p-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="panneau-titre text-lg">{projet.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-encre-douce">
                      {avancement.done}/{avancement.total}
                    </span>
                  </span>
                  <span className={`panneau mt-0.5 block text-[11px] ${style.ink}`}>
                    étape : {style.label}
                  </span>
                  <ProgressBar percent={avancement.percent} className="mt-2" />
                </span>
              </Link>
            )
          })
        )}
      </section>

      {brouillons.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="panneau text-sm text-encre-douce">Brouillons · visibles des chefs seulement</h2>
          {brouillons.map((projet) => (
            <Link
              key={projet.id}
              href={`/cap/${projet.id}`}
              className="rounded-lg border border-dashed border-trait p-3 hover:border-encre-douce"
            >
              <span className="panneau-titre text-lg">{projet.title}</span>
              <span className="block text-xs text-encre-douce">
                {progression[projet.id].total} tâche(s) préparée(s) · pas encore lancé
              </span>
            </Link>
          ))}
        </section>
      ) : null}

      {archives.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="panneau text-sm text-encre-douce">CAP précédents</h2>
          {archives.map((projet) => (
            <Link
              key={projet.id}
              href={`/cap/${projet.id}`}
              className="rounded-lg border border-trait p-3 text-sm hover:border-encre-douce"
            >
              <span className="panneau-titre text-base">{projet.title}</span>
              <span className="block text-xs text-encre-douce">
                archivé le {projet.archivedAt?.toLocaleDateString('fr-FR')} ·{' '}
                {progression[projet.id].done} tâches menées au bout
              </span>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  )
}
