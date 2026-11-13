// src/components/SubmitWorkForm.tsx
'use client'

import { useActionState, useState } from 'react'
import { submitAction } from '@/app/(app)/cap/[projectId]/tache/[taskId]/actions'
import { Picto } from '@/components/sgdf/Picto'
import { EMPTY_FORM_STATE } from '@/lib/formState'
import { reduireChampPhotos } from '@/lib/ui/reduirePhoto'

export function SubmitWorkForm({ taskId, aCorriger }: { taskId: string; aCorriger: boolean }) {
  const [state, action, pending] = useActionState(submitAction, EMPTY_FORM_STATE)
  const [photos, setPhotos] = useState<string[]>([])
  const [preparation, setPreparation] = useState(false)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-trait bg-carte p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <h3 className="font-bold">{aCorriger ? 'Renvoyer après correction' : 'J\'ai fini !'}</h3>

      <textarea
        name="message"
        rows={3}
        placeholder="Raconte ce que tu as fait (facultatif)"
        className="rounded-lg border border-trait bg-surface p-3"
      />

      {/* Sélecteur de photos à nous : celui du navigateur s'affiche en anglais et sans style. */}
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-trait p-3 text-sm hover:border-accent focus-within:border-accent">
        <Picto nom="photo" taille={28} className="text-encre-douce" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{photos.length > 0 ? 'Changer les photos' : 'Ajouter des photos'}</span>
          <span className="block truncate text-xs text-encre-douce">
            {photos.length > 0 ? photos.join(', ') : 'Photos : 3 maximum, 8 Mo chacune'}
          </span>
        </span>
        <input
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={async (e) => {
            const champ = e.currentTarget
            setPhotos(Array.from(champ.files ?? []).map((f) => f.name))
            setPreparation(true)
            try {
              await reduireChampPhotos(champ)
            } finally {
              setPreparation(false)
            }
          }}
          className="sr-only"
        />
      </label>

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button type="submit" disabled={pending || preparation}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        {pending ? 'Envoi…' : preparation ? 'Préparation des photos…' : 'Soumettre aux chefs'}
      </button>
    </form>
  )
}
