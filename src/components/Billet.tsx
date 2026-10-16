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
      className={`flex overflow-hidden rounded-lg border bg-carte ${
        note.pinned ? 'border-accent' : 'border-trait'
      }`}
    >
      {note.pinned ? <span aria-hidden className="w-1.5 shrink-0 bg-accent" /> : null}

      <div className="min-w-0 flex-1 p-3">
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
              className="rounded border border-trait bg-surface p-2"
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
            {note.title ? <h3 className="panneau-titre text-lg">{note.title}</h3> : null}
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{note.body}</p>

            <p className="mt-2 text-xs text-encre-douce">
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
