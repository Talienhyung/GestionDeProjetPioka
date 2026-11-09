'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createEventAction } from '@/app/(app)/agenda/actions'
import { AUDIENCE_LABELS, EVENT_AUDIENCES, EVENT_TEXT_MAX, EVENT_TITLE_MAX } from '@/lib/domain/agenda'
import { EMPTY_FORM_STATE } from '@/lib/formState'

interface Role {
  id: string
  name: string
  holder: { displayName: string } | null
  project: { title: string }
}

const champ = 'rounded-lg border border-trait bg-surface p-3'

export function EvenementForm({ roles, defaultDate }: { roles: Role[]; defaultDate: string }) {
  const [state, action, pending] = useActionState(createEventAction, EMPTY_FORM_STATE)
  const [audience, setAudience] = useState<string>('TOUS')
  const [allDay, setAllDay] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      form.current?.reset()
      setAudience('TOUS')
      setAllDay(false)
    }
  }, [state])

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <input name="title" required maxLength={EVENT_TITLE_MAX} placeholder="Titre : week-end, réunion…" className={champ} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Début
          <input name="startDate" type="date" required defaultValue={defaultDate} className={champ} />
        </label>
        <label className={`flex flex-col gap-1 text-sm ${allDay ? 'opacity-40' : ''}`}>
          Heure
          <input name="startTime" type="time" disabled={allDay} defaultValue="14:00" className={champ} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fin <span className="sr-only">(facultatif)</span>
          <input name="endDate" type="date" className={champ} />
        </label>
        <label className={`flex flex-col gap-1 text-sm ${allDay ? 'opacity-40' : ''}`}>
          Heure de fin
          <input name="endTime" type="time" disabled={allDay} className={champ} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input name="allDay" type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        Toute la journée
      </label>

      <input name="location" placeholder="Lieu (facultatif)" className={champ} />
      <textarea name="description" rows={3} maxLength={EVENT_TEXT_MAX} placeholder="Détails (facultatif)" className={champ} />

      <fieldset className="flex flex-col gap-2">
        <legend className="panneau mb-1 text-[11px] text-encre-douce">Pour qui ?</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_AUDIENCES.map((a) => (
            <label
              key={a}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                audience === a ? 'border-encre bg-encre text-carte' : 'border-trait'
              }`}
            >
              <input
                type="radio"
                name="audience"
                value={a}
                checked={audience === a}
                onChange={() => setAudience(a)}
                className="sr-only"
              />
              {AUDIENCE_LABELS[a]}
            </label>
          ))}
        </div>

        {audience === 'ROLES' ? (
          roles.length === 0 ? (
            <p className="text-sm text-encre-douce">Aucun rôle ouvert : crée d’abord des rôles dans un CAP.</p>
          ) : (
            <ul className="flex flex-col gap-1 rounded-lg border border-trait p-2">
              {roles.map((r) => (
                <li key={r.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="roleIds" value={r.id} className="size-4 accent-[var(--accent)]" />
                    <span className="font-bold">{r.name}</span>
                    <span className="text-xs text-encre-douce">
                      {r.project.title}
                      {r.holder ? ` · ${r.holder.displayName}` : ' · personne'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )
        ) : null}
        <p className="text-xs text-encre-douce">Les chefs voient tous les événements.</p>
      </fieldset>

      {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-ok-doux p-3 text-sm text-ok">{state.success}</p> : null}

      <button type="submit" disabled={pending} className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
        {pending ? 'Ajout…' : 'Ajouter à l’agenda'}
      </button>
    </form>
  )
}
