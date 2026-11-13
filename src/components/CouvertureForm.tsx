'use client'

import { useActionState, useState } from 'react'
import { coverAction } from '@/app/(chef)/pilotage/actions'
import { ChampCouverture } from '@/components/ChampCouverture'
import { EMPTY_FORM_STATE } from '@/lib/formState'

/** Changer ou retirer la couverture d'un CAP existant. */
export function CouvertureForm({ projectId, actuelle }: { projectId: string; actuelle: string | null }) {
  const [state, action, pending] = useActionState(coverAction.bind(null, projectId), EMPTY_FORM_STATE)
  const [reduction, setReduction] = useState(false)

  return (
    <form action={action} className="flex flex-col gap-2">
      <ChampCouverture key={actuelle ?? 'aucune'} actuelle={actuelle} onReduction={setReduction} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || reduction}
          className="panneau flex-1 rounded-lg bg-bouton px-3 py-2 text-xs text-sur-bouton disabled:opacity-60"
        >
          {pending ? '…' : 'Enregistrer la couverture'}
        </button>
        {actuelle ? (
          <button
            type="submit"
            name="retirer"
            value="1"
            formNoValidate
            disabled={pending}
            className="rounded-lg border border-trait px-3 py-2 text-xs"
          >
            Retirer
          </button>
        ) : null}
      </div>
      {state.error ? <p role="alert" className="text-xs text-erreur">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-ok">{state.success}</p> : null}
    </form>
  )
}
