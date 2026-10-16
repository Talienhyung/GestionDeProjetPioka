'use client'

import { useActionState } from 'react'
import { newProjectAction } from '@/app/(chef)/pilotage/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function NewProjectForm({ archiveraLeCourant }: { archiveraLeCourant: boolean }) {
  const [state, action, pending] = useActionState(newProjectAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="title" required placeholder="Titre du nouveau CAP" className="rounded-lg border border-trait p-3" />
      <textarea name="description" rows={2} placeholder="De quoi s'agit-il ? (facultatif)" className="rounded-lg border border-trait p-3" />

      {archiveraLeCourant ? (
        <p className="text-sm text-encre-douce">Le CAP en cours sera archivé automatiquement.</p>
      ) : null}

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        Démarrer ce CAP
      </button>
    </form>
  )
}
