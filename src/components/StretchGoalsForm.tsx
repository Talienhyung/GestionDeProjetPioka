'use client'

import { useActionState, useState } from 'react'
import { setStretchGoalsAction } from '@/app/(admin)/parametres/actions'
import { Icone } from '@/components/Icone'
import { GOALS_MAX, GOAL_LABEL_MAX, type StretchGoal } from '@/lib/domain/stretchGoals'
import { EMPTY_FORM_STATE } from '@/lib/formState'

interface Ligne {
  key: number
  amount: string
  label: string
}

const enSaisie = (cents: number) => (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')

/** Paliers de la barre des récoltes : un montant, et ce qu'il permet d'offrir. */
export function StretchGoalsForm({ goals }: { goals: StretchGoal[] }) {
  const [state, action, pending] = useActionState(setStretchGoalsAction, EMPTY_FORM_STATE)
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    goals.length > 0
      ? goals.map((g, i) => ({ key: i, amount: enSaisie(g.amountCents), label: g.label }))
      : [{ key: 0, amount: '', label: '' }],
  )

  const ajouter = () =>
    setLignes((l) => [...l, { key: Math.max(-1, ...l.map((x) => x.key)) + 1, amount: '', label: '' }])
  const retirer = (key: number) => setLignes((l) => l.filter((x) => x.key !== key))

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-trait bg-carte p-4">
      <ul className="flex flex-col gap-2">
        {lignes.map((ligne, i) => (
          <li key={ligne.key} className="flex items-end gap-2">
            <Icone nom="fanion" taille={20} className="mb-3 shrink-0 text-accent" />
            <label className="flex w-28 shrink-0 flex-col gap-1 text-sm">
              {i === 0 ? 'Montant (€)' : <span className="sr-only">Montant (€)</span>}
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={ligne.amount}
                placeholder="500"
                className="rounded-lg border border-trait bg-carte p-3 tabular-nums"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              {i === 0 ? 'Ce que ça débloque' : <span className="sr-only">Ce que ça débloque</span>}
              <input
                name="label"
                maxLength={GOAL_LABEL_MAX}
                defaultValue={ligne.label}
                placeholder="Les billets de train"
                className="rounded-lg border border-trait bg-carte p-3"
              />
            </label>
            <button
              type="button"
              onClick={() => retirer(ligne.key)}
              aria-label={`Retirer le palier ${i + 1}`}
              className="mb-1 shrink-0 rounded-lg p-2 text-xl leading-none text-encre-douce hover:bg-surface-haute hover:text-erreur"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {lignes.length < GOALS_MAX ? (
        <button
          type="button"
          onClick={ajouter}
          className="panneau self-start rounded-lg border border-dashed border-trait px-3 py-2 text-xs text-accent-encre hover:border-accent"
        >
          + Ajouter un palier
        </button>
      ) : null}

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
      >
        Enregistrer les paliers
      </button>
    </form>
  )
}
