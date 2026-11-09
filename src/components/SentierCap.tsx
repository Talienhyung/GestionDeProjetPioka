import { Icone } from '@/components/Icone'
import { PHASES, type Phase } from '@/lib/domain/types'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

/** Halo de la balise en cours, une classe statique par étape (Tailwind ne lit pas les classes calculées). */
const HALO: Record<Phase, string> = {
  CHOISIR: 'ring-choisir/30',
  AGIR: 'ring-agir/30',
  PARTAGER: 'ring-partager/30',
}

interface Props {
  courante: Phase
  board: Record<Phase, { status: string }[]>
}

/**
 * Le sentier du CAP : trois balises reliées par un chemin. Le tronçon déjà
 * parcouru est tracé plein, la suite en pointillés comme sur une carte.
 * Seule l'étape en cours est vive ; les autres sont des repères, pas des liens.
 */
export function SentierCap({ courante, board }: Props) {
  const iCourant = PHASES.indexOf(courante)

  return (
    <ol aria-label="Étapes du CAP" className="relative grid grid-cols-3 pt-1">
      {PHASES.map((phase, i) => {
        const s = PHASE_STYLES[phase]
        const p = phaseProgress(board[phase])
        const etat = i < iCourant ? 'passee' : i === iCourant ? 'courante' : 'avenir'

        return (
          <li
            key={phase}
            aria-current={etat === 'courante' ? 'step' : undefined}
            className={`relative flex flex-col items-center text-center ${etat === 'avenir' ? 'opacity-45' : ''}`}
          >
            {/* Tronçon de chemin vers l'étape suivante */}
            {i < PHASES.length - 1 ? (
              <span
                aria-hidden
                className={`absolute top-4 left-[calc(50%+1.4rem)] w-[calc(100%-2.8rem)] -translate-y-1/2 ${
                  i < iCourant ? 'h-0.5 rounded-full bg-encre-douce' : 'border-t-2 border-dotted border-trait'
                }`}
              />
            ) : null}

            {/* Balise */}
            <span
              className={`grid size-8 place-items-center rounded-full ${
                etat === 'courante'
                  ? `${s.rail} text-white ring-4 ${HALO[phase]}`
                  : etat === 'passee'
                    ? 'bg-encre-douce text-carte'
                    : 'border-2 border-dashed border-trait text-encre-douce'
              }`}
            >
              {etat === 'passee' ? (
                <Icone nom="coche" taille={16} />
              ) : (
                <span className="brush text-xl leading-none">{s.label[0]}</span>
              )}
            </span>

            <span className={`panneau mt-1.5 text-[10px] ${etat === 'courante' ? s.ink : 'text-encre-douce'}`}>
              {s.label}
              {etat === 'passee' ? <span className="font-normal normal-case tracking-normal"> · {p.done}/{p.total}</span> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
