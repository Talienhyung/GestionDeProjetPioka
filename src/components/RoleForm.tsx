'use client'

import { useActionState } from 'react'
import { createRoleAction } from '@/app/(app)/cap/[projectId]/roles/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

const SUGGESTIONS = ['Trésorier', 'Intendant', 'Responsable communication', 'Responsable matériel', 'Secrétaire']

export function RoleForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createRoleAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input name="name" required list="roles-suggeres" placeholder="Nom du rôle" className="rounded-lg border border-trait p-3" />
      <datalist id="roles-suggeres">
        {SUGGESTIONS.map((nom) => <option key={nom} value={nom} />)}
      </datalist>

      <textarea name="description" rows={2} placeholder="Ce que fait ce rôle (facultatif)" className="rounded-lg border border-trait p-3" />

      <label className="flex items-center gap-2 text-sm">
        Points versés à la clôture
        <input name="points" type="number" min={0} defaultValue={60} className="w-24 rounded-lg border border-trait p-2" />
      </label>

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        Créer le rôle
      </button>
    </form>
  )
}
