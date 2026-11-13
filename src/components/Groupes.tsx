'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { COULEURS_CHARTE } from '@/lib/domain/badgeLook'
import { EMPTY_FORM_STATE, type FormState } from '@/lib/formState'

type Action = (prev: FormState, formData: FormData) => Promise<FormState>

/** Nom + pastilles de couleur de la charte : le formulaire d'un groupe. */
function ChampsGroupe({ nom, couleur }: { nom?: string; couleur?: string | null }) {
  const [choisie, setChoisie] = useState(couleur ?? COULEURS_CHARTE[0])
  return (
    <>
      <input
        name="name"
        required
        minLength={2}
        maxLength={40}
        defaultValue={nom}
        placeholder="Nom du groupe (ex. Les Loups)"
        aria-label="Nom du groupe"
        className="min-w-0 flex-1 rounded-lg border border-trait bg-surface p-3 text-base"
      />
      <input type="hidden" name="color" value={choisie} />
      <div className="flex gap-1.5" role="radiogroup" aria-label="Couleur du groupe">
        {COULEURS_CHARTE.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={choisie === c}
            aria-label={c}
            onClick={() => setChoisie(c)}
            className={`size-8 rounded-full transition-transform ${choisie === c ? 'scale-110 ring-2 ring-encre ring-offset-2 ring-offset-carte' : ''}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </>
  )
}

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="text-sm text-erreur">{state.error}</p>
  if (state.success) return <p className="text-sm text-ok">{state.success}</p>
  return null
}

export function NouveauGroupe({ action, couleur }: { action: Action; couleur: string }) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE)
  const form = useRef<HTMLFormElement>(null)
  const [cle, setCle] = useState(0)
  useEffect(() => {
    if (state.success) {
      form.current?.reset()
      setCle((k) => k + 1)
    }
  }, [state])
  return (
    <form ref={form} action={formAction} className="flex flex-col gap-3 rounded-xl border border-trait bg-carte p-4">
      <div key={cle} className="flex flex-col gap-3">
        <ChampsGroupe couleur={couleur} />
      </div>
      <Message state={state} />
      <button
        type="submit"
        disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
      >
        {pending ? '…' : 'Créer le groupe'}
      </button>
    </form>
  )
}

export function ModifierGroupe({
  action,
  supprimer,
  nom,
  couleur,
  membres,
}: {
  action: Action
  supprimer: () => Promise<FormState>
  nom: string
  couleur: string | null
  membres: number
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE)
  const [enCours, startTransition] = useTransition()
  return (
    <details className="group/mod">
      <summary className="panneau inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-trait px-3 py-1 text-[11px] text-encre-douce hover:border-encre-douce hover:text-encre [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="transition-transform group-open/mod:rotate-90">›</span> Modifier
      </summary>
      <form action={formAction} className="mt-2 flex flex-col gap-3 border-t border-trait pt-3">
        <ChampsGroupe nom={nom} couleur={couleur} />
        <Message state={state} />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="panneau flex-1 rounded-lg bg-bouton p-2 text-sm text-sur-bouton disabled:opacity-60"
          >
            Enregistrer
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => {
              const q =
                membres > 0
                  ? `Supprimer « ${nom} » ? Ses ${membres} jeune${membres > 1 ? 's' : ''} se retrouveront sans groupe.`
                  : `Supprimer « ${nom} » ?`
              if (window.confirm(q)) startTransition(async () => void (await supprimer()))
            }}
            className="rounded-lg px-3 text-sm text-erreur hover:bg-erreur-doux"
          >
            Supprimer
          </button>
        </div>
      </form>
    </details>
  )
}

/** Change le groupe d'un jeune dès qu'on choisit dans la liste. */
export function ChoixGroupe({
  action,
  actuel,
  groupes,
  nom,
}: {
  action: (groupeId: string | null) => Promise<FormState>
  actuel: string | null
  groupes: { id: string; name: string }[]
  nom: string
}) {
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  return (
    <span className="flex flex-col items-end">
      <select
        aria-label={`Groupe de ${nom}`}
        value={actuel ?? ''}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value || null
          startTransition(async () => setErreur((await action(v)).error ?? null))
        }}
        className="max-w-[9.5rem] rounded-lg border border-trait bg-surface px-2 py-1.5 text-sm disabled:opacity-50"
      >
        <option value="">Sans groupe</option>
        {groupes.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      {erreur ? <span className="text-xs text-erreur">{erreur}</span> : null}
    </span>
  )
}
