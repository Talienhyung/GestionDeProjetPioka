import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { ActionButton } from '@/components/ActionButton'
import { CouvertureForm } from '@/components/CouvertureForm'
import { NewProjectForm } from '@/components/NewProjectForm'
import { SupprimerCap } from '@/components/SupprimerCap'
import { ProgressBar } from '@/components/ProgressBar'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES, type Phase } from '@/lib/domain/types'
import { deletionImpact, listProjects } from '@/lib/services/projectService'
import { listBoard } from '@/lib/services/taskService'
import { couvertureUrl } from '@/lib/ui/apparenceBadge'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'
import { archiveAction, deleteAction, launchAction, setPhaseAction } from './actions'

export default async function PilotagePage() {
  await requireChef()
  const projets = await listProjects(db)

  const avancements = Object.fromEntries(
    await Promise.all(
      projets.map(async (projet) => {
        const board = await listBoard(db, projet.id)
        return [projet.id, phaseProgress(PHASES.flatMap((phase) => board[phase]))] as const
      }),
    ),
  )

  const impacts = Object.fromEntries(
    await Promise.all(projets.map(async (projet) => [projet.id, await deletionImpact(db, projet.id)] as const)),
  )

  /** Couverture et suppression : rangées sous un dépli, pour ne pas les avoir sous le pouce. */
  const gerer = (projet: (typeof projets)[number]) => (
    <details className="mt-3 border-t border-trait pt-2">
      <summary className="panneau cursor-pointer text-[11px] text-encre-douce">Couverture et suppression</summary>
      <div className="mt-3 flex flex-col gap-3">
        <CouvertureForm projectId={projet.id} actuelle={couvertureUrl(projet)} />
        <div className="flex justify-end">
          <SupprimerCap
            titre={projet.title}
            impact={impacts[projet.id]}
            archiver={projet.status === 'ARCHIVE' ? null : archiveAction.bind(null, projet.id)}
            supprimer={deleteAction.bind(null, projet.id)}
          />
        </div>
      </div>
    </details>
  )

  const parEtat = {
    BROUILLON: projets.filter((projet) => projet.status === 'BROUILLON'),
    EN_COURS: projets.filter((projet) => projet.status === 'EN_COURS'),
    ARCHIVE: projets.filter((projet) => projet.status === 'ARCHIVE'),
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader picto="destination" surtitre="Gestion" titre="Pilotage" retour={{ href: '/profil', label: 'Profil' }} description="Crée les CAP, choisis l’étape en cours, archive ceux qui sont finis." />

      <section>
        <h2 className="panneau mb-2 text-sm text-encre-douce">En cours ({parEtat.EN_COURS.length})</h2>
        {parEtat.EN_COURS.length === 0 ? (
          <p className="text-sm text-encre-douce">Aucun CAP lancé pour l’instant.</p>
        ) : null}

        <div className="flex flex-col gap-3">
          {parEtat.EN_COURS.map((projet) => (
            <article key={projet.id} className="rounded-xl border border-trait bg-carte p-4">
              <Link href={`/cap/${projet.id}`} className="panneau-titre text-lg underline">
                {projet.title}
              </Link>
              <p className="mt-1 text-xs tabular-nums text-encre-douce">
                {avancements[projet.id].done} tâches terminées sur {avancements[projet.id].total}
              </p>
              <ProgressBar percent={avancements[projet.id].percent} className="mt-2" />

              <h3 className="panneau mt-4 text-xs text-encre-douce">Étape en cours</h3>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PHASES.map((phase) => {
                  const style = PHASE_STYLES[phase as Phase]
                  const courante = projet.currentPhase === phase
                  return (
                    <ActionButton
                      key={phase}
                      action={setPhaseAction.bind(null, projet.id, phase)}
                      className={`panneau rounded-lg border px-3 py-1.5 text-xs ${style.soft} ${style.ink} ${
                        courante ? style.border : 'border-transparent'
                      }`}
                    >
                      {style.label}
                      {courante ? ' ✓' : ''}
                    </ActionButton>
                  )
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/cap/${projet.id}/taches`}
                  className="panneau rounded-lg border border-trait px-3 py-1.5 text-xs"
                >
                  Ajouter des tâches
                </Link>
                <ActionButton
                  action={archiveAction.bind(null, projet.id)}
                  className="rounded-lg border border-trait px-3 py-1.5 text-xs"
                  confirm="Archiver ce CAP ? Il deviendra consultable mais plus modifiable."
                >
                  Archiver
                </ActionButton>
              </div>
              {gerer(projet)}
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="panneau mb-2 text-sm text-encre-douce">
          Brouillons ({parEtat.BROUILLON.length}) · invisibles des jeunes
        </h2>

        <div className="flex flex-col gap-3">
          {parEtat.BROUILLON.map((projet) => (
            <article key={projet.id} className="rounded-xl border border-dashed border-trait p-4">
              <Link href={`/cap/${projet.id}`} className="panneau-titre text-lg underline">
                {projet.title}
              </Link>
              <p className="mt-1 text-xs text-encre-douce">
                {avancements[projet.id].total} tâche(s) préparée(s)
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/cap/${projet.id}/taches`}
                  className="panneau rounded-lg border border-trait px-3 py-1.5 text-xs"
                >
                  Garnir
                </Link>
                <ActionButton
                  action={launchAction.bind(null, projet.id)}
                  className="panneau rounded-lg bg-bouton px-4 py-1.5 text-xs text-sur-bouton"
                  confirm="Lancer ce CAP ? Les jeunes le verront et seront prévenus."
                >
                  Lancer le CAP
                </ActionButton>
              </div>
              {gerer(projet)}
            </article>
          ))}
        </div>

        <div className="mt-3">
          <details className="rounded-xl border border-trait bg-carte px-3 py-2">
            <summary className="panneau cursor-pointer text-sm">Nouveau brouillon</summary>
            <div className="mt-3">
              <NewProjectForm />
            </div>
          </details>
        </div>
      </section>

      {parEtat.ARCHIVE.length > 0 ? (
        <section>
          <h2 className="panneau mb-2 text-sm text-encre-douce">Archivés ({parEtat.ARCHIVE.length})</h2>
          <ul className="flex flex-col gap-2">
            {parEtat.ARCHIVE.map((projet) => (
              <li key={projet.id} className="rounded-lg border border-trait p-3 text-sm">
                <Link href={`/cap/${projet.id}`} className="block">
                  <span className="panneau-titre text-base underline">{projet.title}</span>
                  <span className="block text-xs text-encre-douce">
                    archivé le {projet.archivedAt?.toLocaleDateString('fr-FR')}
                  </span>
                </Link>
                {gerer(projet)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
