import Link from 'next/link'
import { Picto } from '@/components/sgdf/Picto'
import { formatEuros } from '@/lib/domain/money'
import { type StretchGoal, stretchProgress } from '@/lib/domain/stretchGoals'

interface Props {
  collectedCents: number
  goals: StretchGoal[]
  /** Le super admin voit un lien vers les réglages des paliers. */
  canEdit?: boolean
}

/** Montant court pour les repères : « 300 € » plutôt que « 300,00 € ». */
const court = (cents: number) => formatEuros(cents).replace(/,00(?=\s)/, '')

/** Aux bords, le libellé se cale à l'intérieur de la barre au lieu de déborder. */
function ancrage(percent: number) {
  if (percent >= 92) return '-translate-x-full'
  if (percent <= 8) return '-translate-x-1'
  return '-translate-x-1/2'
}

/** Barre des récoltes des extra jobs, jalonnée d'un drapeau par palier. */
export function RecoltesBar({ collectedCents, goals, canEdit = false }: Props) {
  const progress = stretchProgress(collectedCents, goals)
  const hasGoals = progress.markers.length > 0

  return (
    <section aria-label="Nos récoltes" className="rounded-xl border border-trait bg-carte p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="panneau text-[11px] text-encre-douce">Nos récoltes</h2>
          <p className="panneau-titre text-3xl tabular-nums">{formatEuros(collectedCents)}</p>
        </div>
        {progress.next ? (
          <p className="text-right text-xs leading-snug text-encre-douce">
            Prochain palier
            <span className="block font-bold text-encre">{progress.next.label}</span>
          </p>
        ) : null}
      </div>

      {hasGoals ? (
        <>
          <div className="relative mt-8 mb-7">
            <div
              role="progressbar"
              aria-valuenow={Math.round(progress.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avancée vers le dernier palier"
              className="h-2 w-full overflow-hidden rounded-full bg-surface-haute"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            {progress.markers.map((m) => (
              <div
                key={m.amountCents}
                className="absolute top-0 h-2"
                style={{ left: `${m.percent}%` }}
                title={`${m.label} : ${formatEuros(m.amountCents)}`}
              >
                <span
                  aria-hidden
                  className={`absolute top-0 -left-px h-2 w-0.5 ${m.reached ? 'bg-carte/70' : 'bg-trait'}`}
                />
                <Picto
                  nom="drapeau"
                  taille={16}
                  className={`absolute -top-5 -left-0.5 ${m.reached ? 'text-accent' : 'text-trait'}`}
                />
                <span
                  className={`absolute top-3.5 whitespace-nowrap text-[11px] tabular-nums ${ancrage(m.percent)} ${
                    m.reached ? 'font-bold text-encre' : 'text-encre-douce'
                  }`}
                >
                  {court(m.amountCents)}
                </span>
                <span className="sr-only">
                  {m.label} : {m.reached ? 'atteint' : 'pas encore atteint'}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-encre-douce">
            {progress.next ? (
              <>
                Encore <strong className="text-encre tabular-nums">{formatEuros(progress.remainingCents)}</strong>
                {' · '}
                {progress.reachedCount} palier{progress.reachedCount > 1 ? 's' : ''} sur {progress.markers.length}{' '}
                atteint{progress.reachedCount > 1 ? 's' : ''}
              </>
            ) : (
              <strong className="text-accent">Tous les paliers sont atteints. Bravo la caravane !</strong>
            )}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-encre-douce">
          gagnés en extra jobs pour nos CAP en cours
          {canEdit ? (
            <>
              {' · '}
              <Link href="/parametres" className="font-bold text-accent underline">
                poser des paliers
              </Link>
            </>
          ) : null}
        </p>
      )}
    </section>
  )
}
