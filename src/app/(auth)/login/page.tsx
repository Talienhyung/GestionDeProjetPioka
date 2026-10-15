'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, EMPTY_FORM_STATE)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <p className="text-5xl">⛺</p>
        <h1 className="mt-2 text-2xl font-bold">Notre CAP</h1>
        <p className="text-sm opacity-70">Caravane Pionniers-Caravelles</p>
      </header>

      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Identifiant</span>
          <input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
            className="rounded-lg border p-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Mot de passe</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-lg border p-3 text-base"
          />
        </label>

        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="text-center text-xs opacity-70">
        Mot de passe oublié ? Demande à un chef de t’en donner un nouveau.
      </p>
    </main>
  )
}
