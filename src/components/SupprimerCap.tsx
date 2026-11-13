'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { FormState } from '@/lib/formState'

/** Temps de réflexion imposé avant que la suppression devienne possible. */
const DELAI = 6

interface Props {
  titre: string
  impact: { taches: number; points: number; roles: number; billets: number }
  /** null pour un CAP déjà archivé : on ne propose plus l'archivage. */
  archiver: (() => Promise<FormState>) | null
  supprimer: () => Promise<FormState>
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

/**
 * Supprimer un CAP efface tout ce qu'il contient. La fenêtre rappelle ce qui
 * sera perdu, propose d'archiver à la place, et le bouton de suppression ne
 * s'arme qu'après six secondes.
 */
export function SupprimerCap({ titre, impact, archiver, supprimer }: Props) {
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

  const fermer = () => {
    dialog.current?.close()
  }

  const lancer = (action: () => Promise<FormState>) =>
    startTransition(async () => {
      const resultat = await action()
      setState(resultat)
      if (resultat.success) fermer()
    })

  const pertes = [
    impact.taches > 0 ? pluriel(impact.taches, 'tâche', 'tâches') + ' et leurs rendus (photos comprises)' : null,
    impact.points > 0 ? pluriel(impact.points, 'ligne de points', 'lignes de points') + ' : les jeunes perdent les points gagnés ici' : null,
    impact.roles > 0 ? pluriel(impact.roles, 'rôle', 'rôles') : null,
    impact.billets > 0 ? pluriel(impact.billets, 'billet', 'billets') + ' du tableau' : null,
  ].filter(Boolean)

  const restant = Math.ceil((DELAI * 1000 - ecoule) / 1000)
  const arme = restant === 0 && !pending

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setState({})
          setOuvert(true)
          dialog.current?.showModal()
        }}
        className="rounded-lg px-3 py-1.5 text-xs text-erreur hover:bg-erreur-doux"
      >
        Supprimer
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOuvert(false)}
        onClick={(e) => {
          if (e.target === dialog.current && !pending) fermer()
        }}
        className="ecusson-fiche m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-carte p-0 text-encre shadow-2xl backdrop:bg-institution/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-6">
          <div>
            <p className="panneau text-[10px] text-erreur">Suppression définitive</p>
            <h2 className="brush text-3xl leading-tight">Supprimer « {titre} » ?</h2>
          </div>

          {pertes.length > 0 ? (
            <div className="rounded-lg bg-erreur-doux p-3 text-sm">
              <p className="font-bold text-erreur">Tout ceci disparaîtra, sans retour possible :</p>
              <ul className="mt-1 list-disc pl-5 text-encre">
                {pertes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-encre-douce">Ce CAP est vide : rien d’autre ne sera perdu.</p>
          )}

          {archiver ? (
            <div className="rounded-lg border border-trait bg-surface p-3 text-sm">
              <p>
                <strong>Plutôt archiver ?</strong> Le CAP reste consultable, avec ses tâches, ses photos et les
                points de chacun, mais plus personne ne peut le modifier.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => lancer(archiver)}
                className="panneau mt-3 w-full rounded-lg bg-bouton p-3 text-sm text-sur-bouton disabled:opacity-60"
              >
                Archiver à la place
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
              {/* Le fond se remplit pendant le délai de réflexion. */}
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
              onClick={fermer}
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
