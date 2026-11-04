'use client'

import { useActionState } from 'react'
import { newExtraJobAction } from '@/app/(chef)/extra-jobs/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

interface Props {
  jeunes: { id: string; displayName: string }[]
  caps: { id: string; title: string }[]
  today: string
}

export function ExtraJobForm({ jeunes, caps, today }: Props) {
  const [state, action, pending] = useActionState(newExtraJobAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="title" required maxLength={80} placeholder="Quel extra job ? (ex. lavage de voitures)"
        className="rounded-lg border border-trait p-3" />
      <label className="flex flex-col gap-1 text-sm">
        Fait le
        <input type="date" name="doneOn" required defaultValue={today} className="rounded-lg border border-trait p-3" />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="panneau mb-1 text-xs text-encre-douce">Qui l’a fait ?</legend>
        {jeunes.map((jeune) => (
          <label key={jeune.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="workerIds" value={jeune.id} />
            {jeune.displayName}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="panneau mb-1 text-xs text-encre-douce">
          Pour quel(s) CAP ? En euros, laisse vide si rien.
        </legend>
        {caps.map((cap) => (
          <label key={cap.id} className="flex items-center justify-between gap-3 text-sm">
            {cap.title}
            <input name={`montant-${cap.id}`} inputMode="decimal" placeholder="0,00"
              className="w-28 rounded-lg border border-trait p-2 text-right tabular-nums" />
          </label>
        ))}
      </fieldset>

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        Enregistrer
      </button>
    </form>
  )
}
