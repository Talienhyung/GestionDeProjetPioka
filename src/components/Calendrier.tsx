import Link from 'next/link'
import { Icone } from '@/components/Icone'
import { AUDIENCE_LABELS, type EventAudience, dayKey, monthGrid, shiftMonth } from '@/lib/domain/agenda'
import type { AgendaEvent } from '@/lib/services/eventService'

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const TZ = 'Europe/Paris'

interface Props {
  year: number
  month: number
  events: AgendaEvent[]
  /** Jour sélectionné « 2026-11-14 » ; sinon on liste les prochains événements du mois. */
  selected?: string
  /** Page qui porte le calendrier : les liens gardent l'utilisateur dessus. */
  basePath: string
  /** Événements à venir, montrés quand aucun jour n'est choisi. */
  upcoming?: AgendaEvent[]
  footer?: React.ReactNode
}

/** Jours couverts par un événement (un camp de trois jours marque trois cases). */
function joursCouverts(event: AgendaEvent): string[] {
  const debut = dayKey(event.startsAt)
  const fin = event.endsAt ? dayKey(event.endsAt) : debut
  const jours: string[] = []
  const d = new Date(`${debut}T12:00:00Z`)
  for (let i = 0; i < 62; i++) {
    const k = d.toISOString().slice(0, 10)
    jours.push(k)
    if (k >= fin) break
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return jours
}

export function heureEvenement(event: Pick<AgendaEvent, 'startsAt' | 'endsAt' | 'allDay'>): string {
  const jour = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
  const heure = (d: Date) => d.toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  const surPlusieursJours = event.endsAt && dayKey(event.endsAt) !== dayKey(event.startsAt)

  if (surPlusieursJours) return `${jour(event.startsAt)} → ${jour(event.endsAt!)}`
  if (event.allDay) return `${jour(event.startsAt)} · toute la journée`
  return `${jour(event.startsAt)} · ${heure(event.startsAt)}${event.endsAt ? `–${heure(event.endsAt)}` : ''}`
}

const PUCE: Record<EventAudience, string> = {
  TOUS: 'bg-accent',
  CHEFS: 'bg-institution',
  ROLES: 'bg-agir',
}

export function EvenementLigne({ event, children }: { event: AgendaEvent; children?: React.ReactNode }) {
  const audience = event.audience as EventAudience
  return (
    <li className="flex gap-3 rounded-lg border border-trait bg-carte p-3">
      <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${PUCE[audience]}`} />
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug">{event.title}</p>
        <p className="text-xs text-encre-douce">
          {heureEvenement(event)}
          {event.location ? ` · ${event.location}` : ''}
        </p>
        {event.description ? <p className="mt-1 whitespace-pre-wrap text-sm">{event.description}</p> : null}
        {audience !== 'TOUS' ? (
          <p className="panneau mt-1 text-[10px] text-encre-douce">
            {audience === 'ROLES'
              ? `Pour : ${event.roles.map((r) => r.projectRole.name).join(', ')}`
              : AUDIENCE_LABELS[audience]}
          </p>
        ) : null}
        {children}
      </div>
    </li>
  )
}

/** Légende des pastilles, limitée aux publics présents ce mois-ci. */
function Legende({ events }: { events: AgendaEvent[] }) {
  const presents = new Set(events.map((e) => e.audience as EventAudience))
  if (presents.size < 2) return null
  const libelles: Record<EventAudience, string> = { TOUS: 'Tout le monde', CHEFS: 'Chefs', ROLES: 'Rôles' }
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-encre-douce">
      {(Object.keys(libelles) as EventAudience[])
        .filter((a) => presents.has(a))
        .map((a) => (
          <li key={a} className="flex items-center gap-1">
            <span aria-hidden className={`size-1.5 rounded-full ${PUCE[a]}`} />
            {libelles[a]}
          </li>
        ))}
    </ul>
  )
}

export function Calendrier({ year, month, events, selected, basePath, upcoming = [], footer }: Props) {
  const grille = monthGrid(year, month)
  const aujourdhui = dayKey(new Date())
  const mois = `${year}-${String(month).padStart(2, '0')}`
  const titre = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const parJour = new Map<string, AgendaEvent[]>()
  for (const event of events) {
    for (const k of joursCouverts(event)) parJour.set(k, [...(parJour.get(k) ?? []), event])
  }

  const lien = (m: string, jour?: string) => `${basePath}?mois=${m}${jour ? `&jour=${jour}` : ''}`
  const duJour = selected ? (parJour.get(selected) ?? []) : []

  return (
    <section aria-label="Agenda" className="rounded-xl border border-trait bg-carte p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="panneau-titre text-xl capitalize">{titre}</h2>
        <div className="flex items-center gap-1">
          <Link
            href={lien(shiftMonth(year, month, -1))}
            scroll={false}
            aria-label="Mois précédent"
            className="grid size-8 place-items-center rounded-full hover:bg-surface-haute"
          >
            <Icone nom="chevron" taille={18} className="rotate-180" />
          </Link>
          <Link
            href={basePath}
            scroll={false}
            className="panneau rounded-full px-2 py-1 text-[10px] text-encre-douce hover:bg-surface-haute"
          >
            Aujourd’hui
          </Link>
          <Link
            href={lien(shiftMonth(year, month, 1))}
            scroll={false}
            aria-label="Mois suivant"
            className="grid size-8 place-items-center rounded-full hover:bg-surface-haute"
          >
            <Icone nom="chevron" taille={18} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center">
        {JOURS.map((j, i) => (
          <span key={i} className="panneau pb-1 text-[10px] text-encre-douce">
            {j}
          </span>
        ))}
        {grille.map((cell) => {
          const evts = parJour.get(cell.key) ?? []
          const choisi = cell.key === selected
          const estAujourdhui = cell.key === aujourdhui
          return (
            <Link
              key={cell.key}
              href={lien(mois, choisi ? undefined : cell.key)}
              scroll={false}
              aria-label={`${cell.day}${evts.length ? `, ${evts.length} événement(s)` : ''}`}
              className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-sm tabular-nums transition-colors ${
                cell.inMonth ? '' : 'text-encre-douce/40'
              } ${choisi ? 'bg-encre text-carte' : 'hover:bg-surface-haute'}`}
            >
              <span
                className={`grid size-7 place-items-center rounded-full ${
                  estAujourdhui && !choisi ? 'bg-accent font-bold text-sur-accent' : ''
                }`}
              >
                {cell.day}
              </span>
              <span className="flex h-1 gap-0.5">
                {evts.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={`size-1 rounded-full ${choisi ? 'bg-carte' : PUCE[e.audience as EventAudience]}`}
                  />
                ))}
              </span>
            </Link>
          )
        })}
      </div>

      <Legende events={events} />

      <div className="mt-3 border-t border-trait pt-3">
        <h3 className="panneau mb-2 text-[11px] text-encre-douce">
          {selected
            ? new Date(`${selected}T12:00:00Z`).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'UTC',
              })
            : 'À venir'}
        </h3>
        {(selected ? duJour : upcoming).length === 0 ? (
          <p className="text-sm text-encre-douce">{selected ? 'Rien ce jour-là.' : 'Rien de prévu pour l’instant.'}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(selected ? duJour : upcoming).map((e) => (
              <EvenementLigne key={e.id} event={e} />
            ))}
          </ul>
        )}
        {footer}
      </div>
    </section>
  )
}
