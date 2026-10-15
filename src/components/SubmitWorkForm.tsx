// src/components/SubmitWorkForm.tsx
'use client'

import { useActionState } from 'react'
import { submitAction } from '@/app/(app)/cap/[taskId]/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function SubmitWorkForm({ taskId, aCorriger }: { taskId: string; aCorriger: boolean }) {
  const [state, action, pending] = useActionState(submitAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <h3 className="font-bold">{aCorriger ? 'Renvoyer après correction' : 'J\'ai fini !'}</h3>

      <textarea
        name="message"
        rows={3}
        placeholder="Raconte ce que tu as fait (facultatif)"
        className="rounded-lg border p-3"
      />

      <label className="text-sm">
        Photos (3 maximum, 8 Mo chacune)
        <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple
          className="mt-1 block w-full text-sm" />
      </label>

      {state.error ? <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
        {pending ? 'Envoi…' : 'Soumettre aux chefs'}
      </button>
    </form>
  )
}
