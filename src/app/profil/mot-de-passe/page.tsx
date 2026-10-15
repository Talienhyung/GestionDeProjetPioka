// src/app/profil/mot-de-passe/page.tsx
'use client'

import { useActionState } from 'react'
import { EMPTY_FORM_STATE } from '@/lib/formState'
import { changePasswordAction } from './actions'

export default function ChangePasswordPage() {
  const [state, action, pending] = useActionState(changePasswordAction, EMPTY_FORM_STATE)

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">Choisis ton mot de passe</h1>
      <p className="text-sm opacity-70">8 caractères minimum. Ne le partage avec personne.</p>

      <form action={action} className="flex flex-col gap-4">
        <input name="current" type="password" placeholder="Mot de passe actuel" required
          autoComplete="current-password" className="rounded-lg border p-3" />
        <input name="next" type="password" placeholder="Nouveau mot de passe" required minLength={8}
          autoComplete="new-password" className="rounded-lg border p-3" />
        <input name="confirm" type="password" placeholder="Confirme le nouveau" required minLength={8}
          autoComplete="new-password" className="rounded-lg border p-3" />

        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p>
        ) : null}

        <button type="submit" disabled={pending}
          className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
          Enregistrer
        </button>
      </form>
    </main>
  )
}
