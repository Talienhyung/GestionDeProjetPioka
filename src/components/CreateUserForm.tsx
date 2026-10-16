'use client'

import { useActionState } from 'react'
import { createUserAction } from '@/app/(admin)/comptes/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-trait p-4">
      <input name="displayName" required placeholder="Nom affiché (ex. Lucie M.)" className="rounded-lg border border-trait p-3" />
      <input name="username" required autoCapitalize="none" placeholder="Identifiant (ex. lucie)"
        pattern="[A-Za-z0-9._-]{3,30}" className="rounded-lg border border-trait p-3" />

      <label className="flex flex-col gap-1 text-sm">
        Type de compte
        <select name="role" defaultValue="JEUNE" className="rounded-lg border border-trait p-3">
          <option value="JEUNE">Jeune</option>
          <option value="CHEF">Chef</option>
          <option value="SUPER_ADMIN">Super admin</option>
        </select>
      </label>

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? (
        <p className="rounded-lg border-2 border-ok bg-ok-doux p-3 text-sm font-bold text-ok">
          {state.success}
          <span className="mt-1 block font-normal">Note-le maintenant : il ne sera plus affiché.</span>
        </p>
      ) : null}

      <button type="submit" disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        Créer le compte
      </button>
    </form>
  )
}
