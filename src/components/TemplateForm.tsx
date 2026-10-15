'use client'

import { useActionState } from 'react'
import { saveAsTemplateAction } from '@/app/(chef)/taches/actions'
import { DIFFICULTIES, DIFFICULTY_LABELS, PHASES, PHASE_LABELS } from '@/lib/domain/types'
import { EMPTY_FORM_STATE } from '@/lib/formState'

/** Enregistre un modèle réutilisable d'un CAP à l'autre. */
export function TemplateForm() {
  const [state, action, pending] = useActionState(saveAsTemplateAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border p-4">
      <input name="title" required placeholder="Titre du modèle" className="rounded-lg border p-3" />
      <textarea name="description" rows={2} placeholder="Description (facultatif)" className="rounded-lg border p-3" />

      <div className="flex gap-3">
        <select name="phase" defaultValue="AGIR" aria-label="Phase" className="flex-1 rounded-lg border p-3">
          {PHASES.map((phase) => <option key={phase} value={phase}>{PHASE_LABELS[phase]}</option>)}
        </select>
        <select name="difficulty" defaultValue="MOYEN" aria-label="Difficulté" className="flex-1 rounded-lg border p-3">
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
        </select>
      </div>

      {state.error ? <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{state.success}</p> : null}

      <button type="submit" disabled={pending} className="rounded-lg border p-3 font-semibold disabled:opacity-60">
        Enregistrer comme modèle
      </button>
    </form>
  )
}
