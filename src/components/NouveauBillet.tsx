'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createNoteAction } from '@/app/(app)/tableau/actions'
import { PictoMasque } from '@/components/sgdf/PictoMasque'
import { EMPTY_FORM_STATE } from '@/lib/formState'
import { TEXTE_MAX, TITRE_MAX } from '@/lib/services/noteService'
import { reduireChampPhotos } from '@/lib/ui/reduirePhoto'

type Genre = 'billet' | 'photo'

/**
 * Le bouton « + » du tableau, en bas à droite, au-dessus de la barre de
 * navigation : un disque orange dont la croix est découpée. Il ouvre la
 * fenêtre d'écriture, billet ou photo polaroid.
 */
export function NouveauBillet({ projectId }: { projectId: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const formulaire = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(createNoteAction, EMPTY_FORM_STATE)
  const [genre, setGenre] = useState<Genre>('billet')
  const [apercu, setApercu] = useState<string | null>(null)
  const [reduction, setReduction] = useState(false)
  // Change à chaque ouverture : remet le formulaire à neuf.
  const [tour, setTour] = useState(0)

  const ouvrir = () => {
    setTour((t) => t + 1)
    setApercu(null)
    dialog.current?.showModal()
  }

  // Billet épinglé : on referme, le mur se met à jour tout seul.
  useEffect(() => {
    if (state.success) dialog.current?.close()
  }, [state])

  useEffect(() => {
    return () => {
      if (apercu) URL.revokeObjectURL(apercu)
    }
  }, [apercu])

  const champ = 'rounded-lg border border-trait bg-surface p-3 text-base'

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        aria-label="Écrire un billet"
        className="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 size-16 rounded-full drop-shadow-[0_6px_10px_rgb(0_58_93/0.35)] transition-transform hover:scale-105 active:scale-95"
      >
        {/* Disque orange, croix évidée : on voit le tableau à travers. */}
        <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
          <defs>
            <mask id="plus-evide">
              <rect width="64" height="64" fill="#fff" />
              <rect x="28.5" y="16" width="7" height="32" rx="3.5" fill="#000" />
              <rect x="16" y="28.5" width="32" height="7" rx="3.5" fill="#000" />
            </mask>
          </defs>
          <circle cx="32" cy="32" r="32" fill="var(--choisir)" mask="url(#plus-evide)" />
        </svg>
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === dialog.current && !pending) dialog.current?.close()
        }}
        className="ecusson-fiche m-auto w-[min(26rem,calc(100vw-1.5rem))] rounded-2xl bg-carte p-0 text-encre shadow-2xl backdrop:bg-institution/50 backdrop:backdrop-blur-sm"
      >
        <form key={tour} ref={formulaire} action={action} className="flex flex-col gap-4 p-5">
          <input type="hidden" name="projectId" value={projectId ?? ''} />
          <input type="hidden" name="genre" value={genre} />

          <div className="flex items-center justify-between">
            <h2 className="brush text-3xl leading-none">Épingler au tableau</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Fermer"
              className="grid size-8 place-items-center rounded-full text-xl text-encre-douce hover:bg-surface-haute"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 rounded-xl bg-surface-haute p-1" role="tablist">
            {(['billet', 'photo'] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={genre === g}
                onClick={() => setGenre(g)}
                className={`panneau flex items-center justify-center gap-2 rounded-lg py-2 text-xs ${
                  genre === g ? 'bg-carte shadow-sm' : 'text-encre-douce'
                }`}
              >
                <PictoMasque cle={g === 'billet' ? 'lettre' : 'appareil_photo'} taille={16} />
                {g === 'billet' ? 'Billet' : 'Photo'}
              </button>
            ))}
          </div>

          {genre === 'billet' ? (
            <>
              <input name="title" maxLength={TITRE_MAX} placeholder="Titre (facultatif)" className={champ} />
              <textarea
                name="body"
                rows={5}
                required
                maxLength={TEXTE_MAX}
                placeholder="Une idée, une liste, un rappel…"
                className={champ}
                autoFocus
              />
            </>
          ) : (
            <>
              <div className="mx-auto w-56 bg-white p-3 pb-2 shadow-[0_2px_10px_rgb(0_58_93/0.25)]">
                <label className="relative grid aspect-square cursor-pointer place-items-center overflow-hidden bg-surface-haute">
                  {apercu ? (
                    // eslint-disable-next-line @next/next/no-img-element -- aperçu local
                    <img src={apercu} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-center text-xs text-encre-douce">
                      <PictoMasque cle="appareil_photo" taille={36} className="text-accent" />
                      {reduction ? 'Allègement…' : 'Choisir une photo'}
                    </span>
                  )}
                <input
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="sr-only"
                  onChange={async (e) => {
                    const input = e.currentTarget
                    const fichier = input.files?.[0]
                    if (!fichier) return
                    setReduction(true)
                    const [reduite] = await reduireChampPhotos(input)
                    setReduction(false)
                    setApercu(URL.createObjectURL(reduite ?? fichier))
                  }}
                />
                </label>
                <input
                  name="title"
                  maxLength={TITRE_MAX}
                  placeholder="Légende…"
                  aria-label="Légende"
                  className="brush mt-2 w-full bg-transparent text-center text-2xl leading-none outline-none placeholder:text-encre-douce/60"
                />
              </div>
              <p className="text-center text-xs text-encre-douce">Recadrée en carré, comme un polaroid.</p>
            </>
          )}

          {state.error ? (
            <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending || reduction}
            className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
          >
            {pending ? 'Envoi…' : 'Épingler au tableau'}
          </button>
        </form>
      </dialog>
    </>
  )
}
