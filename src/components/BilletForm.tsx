'use client'

import { useActionState } from 'react'
import { createNoteAction } from '@/app/(app)/tableau/actions'
import { TEXTE_MAX, TITRE_MAX } from '@/lib/services/noteService'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function BilletForm({ projectId }: { projectId: string | null }) {
  const [state, action, pending] = useActionState(createNoteAction, EMPTY_FORM_STATE)

  return (
    <details className="rounded-xl border border-trait bg-carte px-4 py-3">
      <summary className="panneau cursor-pointer text-sm text-accent">+ Écrire un billet</summary>

      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="projectId" value={projectId ?? ''} />
        <input
          name="title"
          maxLength={TITRE_MAX}
          placeholder="Titre (facultatif)"
          className="rounded-lg border border-trait bg-surface p-3"
        />
        <textarea
          name="body"
          rows={4}
          required
          maxLength={TEXTE_MAX}
          placeholder="Une idée, une liste, un rappel…"
          className="rounded-lg border border-trait bg-surface p-3"
        />

        {state.error ? (
          <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
        >
          {pending ? 'Envoi…' : 'Épingler au tableau'}
        </button>
      </form>
    </details>
  )
}
