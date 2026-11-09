'use client'

import { useActionState } from 'react'
import { setScaleAction } from '@/app/(admin)/parametres/actions'
import type { PointsScale } from '@/lib/domain/points'
import { DIFFICULTIES, DIFFICULTY_LABELS } from '@/lib/domain/types'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function ScaleForm({ scale }: { scale: PointsScale }) {
  const [state, action, pending] = useActionState(setScaleAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-trait p-4">
      <div className="flex gap-3">
        {DIFFICULTIES.map((difficulty) => (
          <label key={difficulty} className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            {DIFFICULTY_LABELS[difficulty]}
            <input name={difficulty} type="number" min={1} defaultValue={scale[difficulty]}
              className="w-full min-w-0 rounded-lg border border-trait bg-carte p-3" />
          </label>
        ))}
      </div>

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        Enregistrer le barème
      </button>
    </form>
  )
}
