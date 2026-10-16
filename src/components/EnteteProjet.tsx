import { Itineraire } from '@/components/Itineraire'
import type { Phase } from '@/lib/domain/types'

interface Props {
  projet: { title: string; status: string; currentPhase: string; archivedAt: Date | null }
  board: Record<Phase, { status: string }[]>
  avancement: { done: number; total: number }
}

/** Bandeau d'un CAP, avec son état quand il n'est pas simplement en cours. */
export function EnteteProjet({ projet, board, avancement }: Props) {
  const brouillon = projet.status === 'BROUILLON'
  const archive = projet.status === 'ARCHIVE'

  return (
    <div className="flex flex-col gap-4">
      <header className="courbes overflow-hidden rounded-xl bg-bandeau px-4 py-4 text-sur-bandeau">
        <p className="panneau text-xs opacity-90">Notre itinéraire</p>
        <h1 className="panneau-titre mt-0.5 text-3xl">{projet.title}</h1>
        <p className="mt-2 text-sm tabular-nums opacity-90">
          {avancement.done} tâches franchies sur {avancement.total}
        </p>
      </header>

      {brouillon ? (
        <p className="rounded-lg border border-dashed border-trait px-3 py-2 text-sm text-encre-douce">
          Brouillon : les jeunes ne voient pas encore ce CAP. Prépare-le, puis lance-le depuis le pilotage.
        </p>
      ) : null}

      {archive ? (
        <p className="rounded-lg bg-surface-haute px-3 py-2 text-sm text-encre-douce">
          CAP archivé le {projet.archivedAt?.toLocaleDateString('fr-FR')} : consultable, plus modifiable.
        </p>
      ) : null}

      {!brouillon ? <Itineraire board={board} phaseCourante={projet.currentPhase as Phase} /> : null}
    </div>
  )
}
