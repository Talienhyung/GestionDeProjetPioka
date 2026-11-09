import Link from 'next/link'
import { Icone } from '@/components/Icone'
import { PHASES, type Phase } from '@/lib/domain/types'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

/** Ce que veut dire chaque étape, en une ligne. */
export const PHASE_SENS: Record<Phase, string> = {
  CHOISIR: 'on décide du projet',
  AGIR: 'on le réalise',
  PARTAGER: 'on le raconte',
}

interface Props {
  projet: { id: string; title: string; currentPhase: string }
  board: Record<Phase, { status: string; assignments: { user: { id: string } }[] }[]>
  currentUserId: string
}

/** Un CAP en cours : où on en est sur le chemin, et ce qui m'attend. */
export function CapCard({ projet, board, currentUserId }: Props) {
  const courante = projet.currentPhase as Phase
  const indexCourant = PHASES.indexOf(courante)
  const taches = PHASES.flatMap((p) => board[p])
  const total = phaseProgress(taches)
  const aPrendre = board[courante].filter((t) => t.status === 'OUVERTE').length
  const miennes = taches.filter(
    (t) => t.status !== 'TERMINEE' && t.assignments.some((a) => a.user.id === currentUserId),
  ).length

  return (
    <Link
      href={`/cap/${projet.id}`}
      className="group block rounded-2xl border border-trait bg-carte p-4 transition-colors hover:border-encre-douce"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="panneau-titre text-xl leading-tight">{projet.title}</h3>
          <p className="text-xs text-encre-douce tabular-nums">
            {total.done} tâche{total.done > 1 ? 's' : ''} terminée{total.done > 1 ? 's' : ''} sur {total.total}
          </p>
        </div>
        <Icone nom="chevron" taille={20} className="mt-1 shrink-0 text-encre-douce transition-transform group-hover:translate-x-0.5" />
      </div>

      {/* Le chemin C → A → P */}
      <ol className="mt-4 grid grid-cols-3 gap-1.5" aria-label="Étapes du CAP">
        {PHASES.map((phase, i) => {
          const style = PHASE_STYLES[phase]
          const p = phaseProgress(board[phase])
          const etat = i < indexCourant ? 'passee' : i === indexCourant ? 'courante' : 'avenir'
          return (
            <li key={phase} aria-current={etat === 'courante' ? 'step' : undefined}>
              <div className="flex items-center gap-1.5">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    etat === 'avenir' ? 'border-2 border-trait text-encre-douce' : `${style.rail} text-white`
                  }`}
                >
                  {etat === 'passee' ? <Icone nom="coche" taille={13} /> : style.label[0]}
                </span>
                <span
                  className={`panneau truncate text-[11px] ${etat === 'courante' ? style.ink : 'text-encre-douce'}`}
                >
                  {style.label}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-haute">
                <div className={`h-full rounded-full ${style.rail}`} style={{ width: `${p.percent}%` }} />
              </div>
              <p className={`mt-1 text-[10px] tabular-nums ${etat === 'courante' ? `font-bold ${style.ink}` : 'text-encre-douce'}`}>
                {p.total === 0 ? 'pas de tâche' : `${p.done}/${p.total} faites`}
                {etat === 'courante' ? ' · on est ici' : ''}
              </p>
            </li>
          )
        })}
      </ol>

      {/* Ce qui m'attend */}
      {aPrendre > 0 || miennes > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {miennes > 0 ? (
            <span className="rounded-full bg-accent-doux px-2.5 py-1 font-bold text-accent-encre">
              Tu as {miennes} tâche{miennes > 1 ? 's' : ''} en cours
            </span>
          ) : null}
          {aPrendre > 0 ? (
            <span className={`rounded-full px-2.5 py-1 font-bold ${PHASE_STYLES[courante].soft} ${PHASE_STYLES[courante].ink}`}>
              {aPrendre} libre{aPrendre > 1 ? 's' : ''}, à prendre
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  )
}
