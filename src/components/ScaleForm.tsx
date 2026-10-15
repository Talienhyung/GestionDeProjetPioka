'use client'

import { useActionState } from 'react'
import { setScaleAction } from '@/app/(admin)/parametres/actions'
import type { PointsScale } from '@/lib/domain/points'
import { DIFFICULTIES, DIFFICULTY_LABELS } from '@/lib/domain/types'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function ScaleForm({ scale }: { scale: PointsScale }) {
  const [state, action, pending] = useActionState(setScaleAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex gap-3">
        {DIFFICULTIES.map((difficulty) => (
          <label key={difficulty} className="flex flex-1 flex-col gap-1 text-sm">
            {DIFFICULTY_LABELS[difficulty]}
            <input name={difficulty} type="number" min={1} defaultValue={scale[difficulty]}
              className="rounded-lg border p-3" />
          </label>
        ))}
      </div>

      {state.error ? <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
        Enregistrer le barème
      </button>
    </form>
  )
}
