'use client'

import { useActionState, useEffect, useState } from 'react'
import { deleteNoteAction, pinNoteAction, updateNoteAction } from '@/app/(app)/tableau/actions'
import { ActionButton } from '@/components/ActionButton'
import { EMPTY_FORM_STATE } from '@/lib/formState'
import { TEXTE_MAX, TITRE_MAX } from '@/lib/services/noteService'

interface Props {
  note: {
    id: string
    title: string
    body: string
    pinned: boolean
    updatedAt: Date
    author: { id: string; displayName: string }
  }
  projectId: string | null
  currentUserId: string
  isChef: boolean
  modifiable: boolean
}

/** Papiers de la charte, en teintes douces : un billet garde toujours la même couleur. */
const PAPIERS = ['bg-choisir-doux', 'bg-carte', 'bg-agir-doux', 'bg-partager-doux', 'bg-accent-doux']
const INCLINAISONS = ['-rotate-[1.6deg]', 'rotate-[1.2deg]', '-rotate-[0.5deg]', 'rotate-[2deg]', '-rotate-[1.1deg]']

function empreinte(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

function quand(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function Billet({ note, projectId, currentUserId, isChef, modifiable }: Props) {
  const [enEdition, setEnEdition] = useState(false)
  const [state, action, pending] = useActionState(updateNoteAction, EMPTY_FORM_STATE)
  const mien = note.author.id === currentUserId

  // Sans ça, le formulaire reste ouvert après l'enregistrement et on croit
  // que rien ne s'est passé.
  useEffect(() => {
    if (state.success) setEnEdition(false)
  }, [state.success])

  return (
    <article
      className={`relative mb-4 break-inside-avoid rounded-sm pt-3 shadow-[0_1px_2px_rgb(0_58_93/0.12),0_6px_14px_-6px_rgb(0_58_93/0.25)] transition-transform hover:rotate-0 ${
        PAPIERS[empreinte(note.id) % PAPIERS.length]
      } ${enEdition ? '' : INCLINAISONS[empreinte(note.id) % INCLINAISONS.length]}`}
    >
      {/* Punaise : rouge pour un billet épinglé par un chef, bleue sinon. */}
      <span
        aria-hidden
        className={`absolute top-1.5 left-1/2 size-3.5 -translate-x-1/2 rounded-full shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.18),0_2px_3px_rgb(0_0_0/0.25)] ${
          note.pinned ? 'bg-accent' : 'bg-institution/70'
        }`}
      />

      <div className="min-w-0 p-3">
        {note.pinned ? (
          <p className="panneau text-[10px] text-accent-encre">épinglé</p>
        ) : null}

        {enEdition ? (
          <form action={action} className="flex flex-col gap-2">
            <input type="hidden" name="noteId" value={note.id} />
            <input type="hidden" name="projectId" value={projectId ?? ''} />
            <input
              name="title"
              defaultValue={note.title}
              maxLength={TITRE_MAX}
              placeholder="Titre (facultatif)"
              className="rounded border border-trait bg-carte p-2"
            />
            <textarea
              name="body"
              defaultValue={note.body}
              rows={4}
              required
              maxLength={TEXTE_MAX}
              className="rounded border border-trait bg-surface p-2"
            />

            {state.error ? (
              <p role="alert" className="rounded bg-erreur-doux p-2 text-xs text-erreur">{state.error}</p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="panneau rounded bg-bouton px-3 py-1.5 text-xs text-sur-bouton disabled:opacity-60"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setEnEdition(false)}
                className="rounded border border-trait px-3 py-1.5 text-xs"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <>
            {note.title ? <h3 className="panneau-titre text-base leading-snug">{note.title}</h3> : null}
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{note.body}</p>

            <p className="mt-3 text-[11px] text-encre-douce">
              {note.author.displayName} · {quand(note.updatedAt)}
            </p>

            {modifiable ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {mien ? (
                  <button type="button" onClick={() => setEnEdition(true)} className="underline">
                    modifier
                  </button>
                ) : null}

                {mien || isChef ? (
                  <ActionButton
                    action={deleteNoteAction.bind(null, note.id, projectId)}
                    className="underline"
                    confirm="Retirer ce billet du tableau ?"
                  >
                    supprimer
                  </ActionButton>
                ) : null}

                {isChef ? (
                  <ActionButton
                    action={pinNoteAction.bind(null, note.id, projectId, !note.pinned)}
                    className="underline"
                  >
                    {note.pinned ? 'dépingler' : 'épingler'}
                  </ActionButton>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  )
}
