'use client'

import { useActionState } from 'react'
import { createTaskAction } from '@/app/(chef)/taches/actions'
import { DIFFICULTY_LABELS, DIFFICULTIES, PHASES, PHASE_LABELS } from '@/lib/domain/types'
import { EMPTY_FORM_STATE } from '@/lib/formState'

/**
 * Même formulaire pour tous : un chef crée une tâche ouverte, un jeune
 * envoie une proposition. C'est l'action serveur qui tranche, selon le rôle.
 */
export function NewTaskForm({ isChef }: { isChef: boolean }) {
  const [state, action, pending] = useActionState(createTaskAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-trait p-4">
      <input name="title" required placeholder="Titre de la tâche" className="rounded-lg border border-trait p-3" />
      <textarea name="description" rows={3} placeholder="Description (facultatif)" className="rounded-lg border border-trait p-3" />

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Phase
          <select name="phase" defaultValue="AGIR" className="rounded-lg border border-trait p-3">
            {PHASES.map((phase) => (
              <option key={phase} value={phase}>{PHASE_LABELS[phase]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          Difficulté
          <select name="difficulty" defaultValue="MOYEN" className="rounded-lg border border-trait p-3">
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>{DIFFICULTY_LABELS[difficulty]}</option>
            ))}
          </select>
        </label>
      </div>

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        {isChef ? 'Créer la tâche' : 'Proposer cette tâche aux chefs'}
      </button>
    </form>
  )
}
