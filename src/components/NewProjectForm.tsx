'use client'

import { useActionState } from 'react'
import { newProjectAction } from '@/app/(chef)/pilotage/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function NewProjectForm({ archiveraLeCourant }: { archiveraLeCourant: boolean }) {
  const [state, action, pending] = useActionState(newProjectAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="title" required placeholder="Titre du nouveau CAP" className="rounded-lg border p-3" />
      <textarea name="description" rows={2} placeholder="De quoi s'agit-il ? (facultatif)" className="rounded-lg border p-3" />

      {archiveraLeCourant ? (
        <p className="text-sm opacity-70">Le CAP en cours sera archivé automatiquement.</p>
      ) : null}

      {state.error ? <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
        Démarrer ce CAP
      </button>
    </form>
  )
}
