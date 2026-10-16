import type { Phase } from '@/lib/domain/types'
import { PHASES } from '@/lib/domain/types'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

interface Props {
  board: Record<Phase, { status: string }[]>
  phaseCourante: Phase
}

/**
 * Le CAP lu comme un itinéraire : trois jalons balisés, celui où l'on se
 * trouve mis en avant, ce qui est franchi derrière.
 */
export function Itineraire({ board, phaseCourante }: Props) {
  return (
    <ol className="flex items-stretch gap-1.5">
      {PHASES.map((phase) => {
        const style = PHASE_STYLES[phase as Phase]
        const progress = phaseProgress(board[phase as Phase])
        const courante = phase === phaseCourante

        return (
          <li key={phase} className="flex-1">
            <div
              className={`flex items-baseline justify-between gap-1 ${courante ? style.ink : 'text-encre-douce'}`}
            >
              <span className="panneau text-[13px] leading-none">{style.label}</span>
              <span className="text-[11px] tabular-nums">
                {progress.done}/{progress.total}
              </span>
            </div>

            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-haute">
              <div
                className={`h-full rounded-full ${style.rail} transition-[width]`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            {courante ? <p className="mt-1 text-[10px] text-encre-douce">on en est là</p> : null}
          </li>
        )
      })}
    </ol>
  )
}
