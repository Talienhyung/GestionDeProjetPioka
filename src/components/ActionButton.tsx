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
          startTransition(async () => setState(await action()))
        }}
      >
        {pending ? '…' : children}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">{state.error}</span>
      ) : null}
      {state.success ? (
        <span className="text-xs text-emerald-700 dark:text-emerald-400">{state.success}</span>
      ) : null}
    </span>
  )
}
