'use client'

import { use, useActionState } from 'react'
import { loginAction } from './actions'
import { Picto } from '@/components/sgdf/Picto'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export default function LoginPage({ searchParams }: { searchParams: Promise<{ identifiant?: string }> }) {
  // Le QR code des bandes de connexion ouvre la page avec l'identifiant déjà rempli.
  const { identifiant } = use(searchParams)
  const [state, action, pending] = useActionState(loginAction, EMPTY_FORM_STATE)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <Picto nom="tente" taille={64} className="mx-auto text-accent" />
        <h1 className="brush mt-3 text-5xl text-accent">Notre CAP</h1>
        <p className="panneau text-xs text-encre-douce">Caravane Pionniers-Caravelles</p>
      </header>

      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Identifiant</span>
          <input
            name="username"
            defaultValue={typeof identifiant === 'string' ? identifiant.slice(0, 40) : undefined}
            autoComplete="username"
            autoCapitalize="none"
            required
            className="rounded-lg border border-trait p-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Mot de passe</span>
          <input
            name="password"
            type="password"
            autoFocus={Boolean(identifiant)}
            autoComplete="current-password"
            required
            className="rounded-lg border border-trait p-3 text-base"
          />
        </label>

        {state.error ? (
          <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
        >
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="text-center text-xs text-encre-douce">
        Mot de passe oublié ? Demande à un chef de t’en donner un nouveau.
      </p>
    </main>
  )
}
