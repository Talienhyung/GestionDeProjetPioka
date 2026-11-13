'use client'

import { type ReactNode, useActionState, useEffect, useState } from 'react'
import { deleteNoteAction, pinNoteAction, updateNoteAction } from '@/app/(app)/tableau/actions'
import { ActionButton } from '@/components/ActionButton'
import { EMPTY_FORM_STATE } from '@/lib/formState'
import { TEXTE_MAX, TITRE_MAX } from '@/lib/services/noteService'

interface Props {
  note: {
    id: string
    title: string
    body: string
    imageName: string | null
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

  const inclinaison = INCLINAISONS[empreinte(note.id) % INCLINAISONS.length]

  if (note.imageName) {
    return (
      <Polaroid
        note={note}
        inclinaison={inclinaison}
        actions={
          modifiable ? (
            <Gestes note={note} projectId={projectId} mien={mien} isChef={isChef} onModifier={null} />
          ) : null
        }
      />
    )
  }

  return (
    <article
      className={`relative mb-4 break-inside-avoid rounded-sm pt-3 shadow-[0_1px_2px_rgb(0_58_93/0.12),0_6px_14px_-6px_rgb(0_58_93/0.25)] transition-transform hover:rotate-0 ${
        PAPIERS[empreinte(note.id) % PAPIERS.length]
      } ${enEdition ? '' : inclinaison}`}
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

            <div className="mt-3 flex items-end justify-between gap-2">
              <p className="text-[11px] leading-tight text-encre-douce">
                {note.author.displayName}
                <span className="block">{quand(note.updatedAt)}</span>
              </p>
              {modifiable ? (
                <Gestes note={note} projectId={projectId} mien={mien} isChef={isChef} onModifier={() => setEnEdition(true)} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </article>
  )
}

const bouton =
  'grid size-7 place-items-center rounded-full text-encre-douce transition-colors hover:bg-encre/10 hover:text-encre'

/** Modifier, épingler, supprimer : des icônes, groupées en bas à droite du billet. */
function Gestes({
  note,
  projectId,
  mien,
  isChef,
  onModifier,
}: {
  note: Props['note']
  projectId: string | null
  mien: boolean
  isChef: boolean
  /** null : rien à réécrire (un polaroid n'a que sa photo et sa légende). */
  onModifier: (() => void) | null
}) {
  if (!mien && !isChef) return null
  return (
    <div className="-mr-1 -mb-1 flex shrink-0 items-center">
      {mien && onModifier ? (
        <button type="button" onClick={onModifier} aria-label="modifier" title="Modifier" className={bouton}>
          <IconeCrayon />
        </button>
      ) : null}

      {isChef ? (
        <ActionButton
          action={pinNoteAction.bind(null, note.id, projectId, !note.pinned)}
          label={note.pinned ? 'dépingler' : 'épingler'}
          className={`${bouton} ${note.pinned ? '!text-accent' : ''}`}
        >
          <IconePunaise pleine={note.pinned} />
        </ActionButton>
      ) : null}

      <ActionButton
        action={deleteNoteAction.bind(null, note.id, projectId)}
        label="supprimer"
        confirm="Retirer ce billet du tableau ?"
        className={`${bouton} hover:!bg-erreur-doux hover:!text-erreur`}
      >
        <IconeCorbeille />
      </ActionButton>
    </div>
  )
}

const trait = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function IconeCrayon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path {...trait} d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z M13.5 6.5l4 4" />
    </svg>
  )
}

function IconeCorbeille() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path {...trait} d="M4 7h16 M10 11v6 M14 11v6 M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12 M9 7V4h6v3" />
    </svg>
  )
}

function IconePunaise({ pleine }: { pleine: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        {...trait}
        fill={pleine ? 'currentColor' : 'none'}
        d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z"
      />
      <path {...trait} d="M12 14v7" />
    </svg>
  )
}

/** Une photo épinglée : un polaroid, légende manuscrite dessous, punaisé. */
function Polaroid({ note, inclinaison, actions }: { note: Props['note']; inclinaison: string; actions: ReactNode }) {
  return (
    <article
      className={`relative mb-4 break-inside-avoid bg-white p-2.5 pb-2 shadow-[0_1px_2px_rgb(0_58_93/0.15),0_8px_16px_-6px_rgb(0_58_93/0.35)] transition-transform hover:rotate-0 ${inclinaison}`}
    >
      {/* Un bout de ruban adhésif plutôt qu'une punaise : on ne perce pas une photo. */}
      <span
        aria-hidden
        className={`absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[-3deg] shadow-sm ${
          note.pinned ? 'bg-accent/70' : 'bg-choisir-doux/90'
        }`}
      />
      <div className="aspect-square overflow-hidden bg-surface-haute">
        {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, après session */}
        <img
          src={`/api/billets/${note.id}/image?v=${note.imageName?.slice(0, 10)}`}
          alt={note.title || `Photo de ${note.author.displayName}`}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      {note.title ? <p className="brush mt-1.5 text-center text-xl leading-tight break-words">{note.title}</p> : null}
      <div className={`flex items-end justify-between gap-1 ${note.title ? '' : 'mt-1.5'}`}>
        <p className="text-[10px] leading-tight text-encre-douce">
          {note.author.displayName}
          <span className="block">{quand(note.updatedAt)}</span>
        </p>
        {actions}
      </div>
      {note.pinned ? <p className="panneau text-[9px] text-accent-encre">épinglé</p> : null}
    </article>
  )
}
