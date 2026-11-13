'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { type ApparenceBadge, Ecusson } from '@/components/Ecusson'
import { EMPTY_FORM_STATE, type FormState } from '@/lib/formState'

type Action = (prev: FormState, formData: FormData) => Promise<FormState>

interface Projet {
  id: string
  title: string
}

function Retour({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">
        {state.error}
      </p>
    )
  }
  if (state.success) return <p className="rounded-lg bg-ok-doux p-3 text-sm font-semibold text-ok">{state.success}</p>
  return null
}

/** Remet le formulaire à zéro après un succès. */
function useRemiseAZero(state: FormState) {
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.success) form.current?.reset()
  }, [state])
  return form
}

function ChoixCap({ projets, optionnel }: { projets: Projet[]; optionnel?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">Compter dans le CAP</span>
      <select
        name="projectId"
        defaultValue={projets[0]?.id ?? ''}
        required={!optionnel}
        className="rounded-lg border border-trait bg-surface p-3 text-base"
      >
        {optionnel ? <option value="">{optionnel}</option> : null}
        {projets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  )
}

function Raison({ placeholder }: { placeholder: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">Pourquoi ?</span>
      <textarea
        name="reason"
        required
        minLength={3}
        maxLength={300}
        rows={2}
        placeholder={placeholder}
        className="rounded-lg border border-trait bg-surface p-3 text-base"
      />
      <span className="text-xs text-encre-douce">Le jeune le lira sur son profil et dans son parcours.</span>
    </label>
  )
}

export interface BadgeAChoisir {
  id: string
  name: string
  points: number
  apparence: ApparenceBadge
  dejaGagne: boolean
}

export function RemettreBadge({
  action,
  badges,
  projets,
}: {
  action: Action
  badges: BadgeAChoisir[]
  projets: Projet[]
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE)
  const form = useRemiseAZero(state)
  const disponibles = badges.filter((b) => !b.dejaGagne)
  const [choisi, setChoisi] = useState<string | null>(null)
  const badge = badges.find((b) => b.id === choisi)

  if (disponibles.length === 0) {
    return <p className="text-sm text-encre-douce">Il a déjà tous les écussons. Chapeau.</p>
  }

  return (
    <form ref={form} action={formAction} onReset={() => setChoisi(null)} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Quel écusson ?</legend>
        <div className="-mx-1 grid grid-cols-3 gap-1 sm:grid-cols-5">
          {disponibles.map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-xl p-2 text-center text-xs has-[:checked]:bg-surface-haute has-[:checked]:ring-2 has-[:checked]:ring-accent has-[:focus-visible]:ring-2"
            >
              <input
                type="radio"
                name="badgeId"
                value={b.id}
                required
                className="sr-only"
                onChange={() => setChoisi(b.id)}
              />
              <Ecusson {...b.apparence} taille={56} />
              <span className="mt-1 leading-tight font-semibold">{b.name}</span>
              {b.points > 0 ? <span className="text-encre-douce tabular-nums">+{b.points} pts</span> : null}
            </label>
          ))}
        </div>
      </fieldset>

      <Raison placeholder="Ex. : a tenu le feu tout le week-end sans qu'on le lui demande" />
      {badge && badge.points > 0 ? (
        <ChoixCap projets={projets} optionnel="Aucun : l'écusson sans ses points" />
      ) : (
        <input type="hidden" name="projectId" value={projets[0]?.id ?? ''} />
      )}
      <Retour state={state} />
      <button
        type="submit"
        disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
      >
        {pending ? '…' : badge ? `Remettre « ${badge.name} »` : 'Remettre l’écusson'}
      </button>
    </form>
  )
}

const RACCOURCIS = [5, 10, 20, 50]

export function DonnerPoints({ action, projets }: { action: Action; projets: Projet[] }) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE)
  const form = useRemiseAZero(state)
  const [montant, setMontant] = useState('10')
  const [sens, setSens] = useState<'donner' | 'retirer'>('donner')

  if (projets.length === 0) {
    return <p className="text-sm text-encre-douce">Aucun CAP lancé : les points se comptent dans un CAP.</p>
  }

  return (
    <form
      ref={form}
      action={formAction}
      onReset={() => {
        setMontant('10')
        setSens('donner')
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="sens" value={sens} />
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-haute p-1 text-sm font-semibold">
          {(['donner', 'retirer'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sens === s}
              onClick={() => setSens(s)}
              className={`rounded-lg p-2 ${sens === s ? (s === 'donner' ? 'bg-carte text-ok shadow' : 'bg-carte text-erreur shadow') : 'text-encre-douce'}`}
            >
              {s === 'donner' ? 'Donner' : 'Retirer'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className={`brush text-4xl ${sens === 'donner' ? 'text-ok' : 'text-erreur'}`}>
            {sens === 'donner' ? '+' : '−'}
          </span>
          <input
            name="amount"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            required
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            aria-label="Nombre de points"
            className="brush w-24 rounded-lg border border-trait bg-surface p-2 text-center text-3xl tabular-nums"
          />
          <span className="panneau text-xs text-encre-douce">points</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {RACCOURCIS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMontant(String(n))}
              className={`rounded-full border px-3 py-1 text-sm tabular-nums ${
                montant === String(n) ? 'border-accent bg-accent text-sur-accent' : 'border-trait'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <Raison placeholder={sens === 'donner' ? 'Ex. : a rangé tout le local après la vente' : 'Ex. : points comptés deux fois par erreur'} />
      <ChoixCap projets={projets} />
      <Retour state={state} />
      <button
        type="submit"
        disabled={pending}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
      >
        {pending ? '…' : sens === 'donner' ? `Donner ${montant || 0} points` : `Retirer ${montant || 0} points`}
      </button>
    </form>
  )
}
