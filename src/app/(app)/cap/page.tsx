import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { CapCard, PHASE_SENS } from '@/components/CapCard'
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

  const boards = Object.fromEntries(
    await Promise.all(projets.map(async (projet) => [projet.id, await listBoard(db, projet.id)] as const)),
  )
  const progression = Object.fromEntries(
    projets.map((projet) => [projet.id, phaseProgress(PHASES.flatMap((phase) => boards[projet.id][phase]))]),
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        picto="boussole"
        surtitre="La caravane"
        titre="Nos CAP"
        description="Un CAP, c’est le projet de la caravane, mené en trois étapes :"
      >
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {PHASES.map((phase) => {
            const style = PHASE_STYLES[phase as Phase]
            return (
              <li key={phase} className={`rounded-xl p-2.5 ${style.soft}`}>
                <span className={`brush text-3xl leading-none ${style.ink}`}>{style.label[0]}</span>
                <p className={`panneau text-[11px] ${style.ink}`}>{style.label}</p>
                <p className="text-[11px] leading-snug text-encre-douce">{PHASE_SENS[phase as Phase]}</p>
              </li>
            )
          })}
        </ol>
      </PageHeader>

      <section className="flex flex-col gap-3">
        <h2 className="panneau text-[11px] text-encre-douce">En cours</h2>

        {vivants.length === 0 ? (
          <p className="text-sm text-encre-douce">
            Aucun CAP en cours{chef ? ' : lance un brouillon depuis le pilotage.' : ' pour l’instant.'}
          </p>
        ) : (
          vivants.map((projet) => (
            <CapCard key={projet.id} projet={projet} board={boards[projet.id]} currentUserId={user.id} />
          ))
        )}
      </section>

      {brouillons.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="panneau text-[11px] text-encre-douce">Brouillons · visibles des chefs seulement</h2>
          {brouillons.map((projet) => (
            <Link
              key={projet.id}
              href={`/cap/${projet.id}`}
              className="rounded-xl border border-dashed border-trait p-3 hover:border-encre-douce"
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
          <h2 className="panneau text-[11px] text-encre-douce">CAP précédents</h2>
          {archives.map((projet) => (
            <Link
              key={projet.id}
              href={`/cap/${projet.id}`}
              className="rounded-xl border border-trait bg-carte p-3 text-sm hover:border-encre-douce"
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
