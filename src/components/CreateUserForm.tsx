'use client'

import { useActionState } from 'react'
import { createUserAction } from '@/app/(admin)/comptes/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border p-4">
      <input name="displayName" required placeholder="Nom affiché (ex. Lucie M.)" className="rounded-lg border p-3" />
      <input name="username" required autoCapitalize="none" placeholder="Identifiant (ex. lucie)"
        pattern="[A-Za-z0-9._-]{3,30}" className="rounded-lg border p-3" />

      <label className="flex flex-col gap-1 text-sm">
        Type de compte
        <select name="role" defaultValue="JEUNE" className="rounded-lg border p-3">
          <option value="JEUNE">Jeune</option>
          <option value="CHEF">Chef</option>
          <option value="SUPER_ADMIN">Super admin</option>
        </select>
      </label>

      {state.error ? <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p> : null}
      {state.success ? (
        <p className="rounded-lg border-2 border-emerald-600 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {state.success}
          <span className="mt-1 block font-normal">Note-le maintenant : il ne sera plus affiché.</span>
        </p>
      ) : null}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
        Créer le compte
      </button>
    </form>
  )
}
