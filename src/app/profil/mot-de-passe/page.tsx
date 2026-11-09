// src/app/profil/mot-de-passe/page.tsx
'use client'

import { PageHeader } from '@/components/PageHeader'
import { useActionState } from 'react'
import { EMPTY_FORM_STATE } from '@/lib/formState'
import { changePasswordAction } from './actions'

export default function ChangePasswordPage() {
  const [state, action, pending] = useActionState(changePasswordAction, EMPTY_FORM_STATE)

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <PageHeader picto="promesse" surtitre="Ton compte" titre="Mot de passe" description="8 caractères minimum. Ne le partage avec personne." />

      <form action={action} className="flex flex-col gap-4">
        <input name="current" type="password" placeholder="Mot de passe actuel" required
          autoComplete="current-password" className="rounded-lg border border-trait p-3" />
        <input name="next" type="password" placeholder="Nouveau mot de passe" required minLength={8}
          autoComplete="new-password" className="rounded-lg border border-trait p-3" />
        <input name="confirm" type="password" placeholder="Confirme le nouveau" required minLength={8}
          autoComplete="new-password" className="rounded-lg border border-trait p-3" />

        {state.error ? (
          <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p>
        ) : null}

        <button type="submit" disabled={pending}
          className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
          Enregistrer
        </button>
      </form>
    </main>
  )
}
