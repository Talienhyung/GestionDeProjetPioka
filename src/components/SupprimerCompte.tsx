'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { FormState } from '@/lib/formState'

/** Temps de réflexion imposé avant que la suppression devienne possible. */
const DELAI = 6

interface Props {
  nom: string
  /** Proposé à la place, pour un compte encore actif. */
  desactiver: (() => Promise<FormState>) | null
  supprimer: () => Promise<FormState>
}

/**
 * Supprimer un compte efface ce que la personne a rendu, gagné et écrit. La
 * fenêtre le rappelle, propose de désactiver à la place, et le bouton ne
 * s'arme qu'après six secondes.
 */
export function SupprimerCompte({ nom, desactiver, supprimer }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [ecoule, setEcoule] = useState(0)
  const [ouvert, setOuvert] = useState(false)
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<FormState>({})

  useEffect(() => {
    if (!ouvert) return
    setEcoule(0)
    const debut = Date.now()
    const timer = setInterval(() => {
      const e = Math.min(DELAI * 1000, Date.now() - debut)
      setEcoule(e)
      if (e >= DELAI * 1000) clearInterval(timer)
    }, 50)
    return () => clearInterval(timer)
  }, [ouvert])

  const lancer = (action: () => Promise<FormState>) =>
    startTransition(async () => {
      const resultat = (await action()) ?? {}
      setState(resultat)
      if (resultat.success) dialog.current?.close()
    })

  const restant = Math.ceil((DELAI * 1000 - ecoule) / 1000)
  const arme = restant === 0 && !pending

  return (
    <>
      <button
        type="button"
        aria-label={`Supprimer le compte de ${nom}`}
        title="Supprimer le compte"
        onClick={() => {
          setState({})
          setOuvert(true)
          dialog.current?.showModal()
        }}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-erreur hover:bg-erreur-doux"
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7h16 M10 11v6 M14 11v6 M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12 M9 7V4h6v3"
          />
        </svg>
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOuvert(false)}
        onClick={(e) => {
          if (e.target === dialog.current && !pending) dialog.current?.close()
        }}
        className="ecusson-fiche m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-carte p-0 text-encre shadow-2xl backdrop:bg-institution/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-6">
          <div>
            <p className="panneau text-[10px] text-erreur">Suppression définitive</p>
            <h2 className="brush text-3xl leading-tight">Supprimer le compte de {nom} ?</h2>
          </div>

          <div className="rounded-lg bg-erreur-doux p-3 text-sm">
            <p className="font-bold text-erreur">Disparaîtront avec lui, sans retour possible :</p>
            <ul className="mt-1 list-disc pl-5">
              <li>ses travaux rendus et leurs photos</li>
              <li>ses points et ses écussons</li>
              <li>ses billets du tableau</li>
            </ul>
            <p className="mt-2 text-encre-douce">
              Les tâches, activités et petits boulots qu&apos;il a créés restent, à ton nom.
            </p>
          </div>

          {desactiver ? (
            <div className="rounded-lg border border-trait bg-surface p-3 text-sm">
              <p>
                <strong>Plutôt désactiver ?</strong> Le compte ne peut plus se connecter, mais son historique et ses
                points restent dans les CAP.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => lancer(desactiver)}
                className="panneau mt-3 w-full rounded-lg bg-bouton p-3 text-sm text-sur-bouton disabled:opacity-60"
              >
                Désactiver à la place
              </button>
            </div>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-sm text-erreur">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!arme}
              onClick={() => lancer(supprimer)}
              className="relative overflow-hidden rounded-lg border-2 border-erreur p-3 text-sm font-bold text-erreur transition-colors enabled:hover:bg-erreur enabled:hover:text-carte disabled:opacity-70"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-erreur/20"
                style={{ width: `${(ecoule / (DELAI * 1000)) * 100}%` }}
              />
              <span className="relative tabular-nums">
                {pending ? 'Suppression…' : restant > 0 ? `Supprimer définitivement (${restant} s)` : 'Supprimer définitivement'}
              </span>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => dialog.current?.close()}
              className="panneau rounded-lg p-2 text-xs text-encre-douce hover:text-encre"
            >
              Annuler
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
