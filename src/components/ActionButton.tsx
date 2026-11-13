'use client'

import { useState, useTransition, type ReactNode } from 'react'
import type { FormState } from '@/lib/formState'

interface Props {
  /** Action serveur déjà liée à ses arguments, qui rend un FormState. */
  action: () => Promise<FormState>
  children: ReactNode
  className?: string
  /** Question posée avant d'agir, pour les gestes difficiles à défaire. */
  confirm?: string
}

/**
 * Bouton d'action serveur avec état d'attente et message de retour.
 * `<form action={…}>` n'accepte qu'une action rendant void : ce composant
 * est le passage obligé pour les actions qui rendent un FormState.
 */
export function ActionButton({ action, children, className = '', confirm }: Props) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<FormState>({})

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className={`${className} disabled:opacity-60`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return
          // Une action qui redirige (suppression, par exemple) ne rend rien.
          startTransition(async () => setState((await action()) ?? {}))
        }}
      >
        {pending ? '…' : children}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-erreur">{state.error}</span>
      ) : null}
      {state.success ? (
        <span className="text-xs text-ok">{state.success}</span>
      ) : null}
    </span>
  )
}
