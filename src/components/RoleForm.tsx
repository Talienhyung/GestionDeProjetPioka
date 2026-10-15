'use client'

import { useActionState } from 'react'
import { createRoleAction } from '@/app/(app)/roles/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

const SUGGESTIONS = ['Trésorier', 'Intendant', 'Responsable communication', 'Responsable matériel', 'Secrétaire']

export function RoleForm() {
  const [state, action, pending] = useActionState(createRoleAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="name" required list="roles-suggeres" placeholder="Nom du rôle" className="rounded-lg border p-3" />
      <datalist id="roles-suggeres">
        {SUGGESTIONS.map((nom) => <option key={nom} value={nom} />)}
      </datalist>

      <textarea name="description" rows={2} placeholder="Ce que fait ce rôle (facultatif)" className="rounded-lg border p-3" />

      <label className="flex items-center gap-2 text-sm">
        Points versés à la clôture
        <input name="points" type="number" min={0} defaultValue={60} className="w-24 rounded-lg border p-2" />
      </label>

      {state.error ? <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
        Créer le rôle
      </button>
    </form>
  )
}
