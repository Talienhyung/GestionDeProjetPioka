'use client'

import { useActionState, useState } from 'react'
import { newProjectAction } from '@/app/(chef)/pilotage/actions'
import { ChampCouverture } from '@/components/ChampCouverture'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function NewProjectForm() {
  const [state, action, pending] = useActionState(newProjectAction, EMPTY_FORM_STATE)
  const [reduction, setReduction] = useState(false)

  return (
    <form action={action} className="flex flex-col gap-3">
      <ChampCouverture onReduction={setReduction} />
      <input name="title" required placeholder="Titre du nouveau CAP" className="rounded-lg border border-trait p-3" />
      <textarea name="description" rows={2} placeholder="De quoi s'agit-il ? (facultatif)" className="rounded-lg border border-trait p-3" />

      <p className="text-sm text-encre-douce">
        Il naît en brouillon : les jeunes ne le verront qu’une fois lancé.
      </p>

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button type="submit" disabled={pending || reduction}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        {pending ? 'Création…' : 'Créer le brouillon'}
      </button>
    </form>
  )
}
