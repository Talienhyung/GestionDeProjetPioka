// src/lib/domain/agenda.ts
import type { AppRole } from './types'

export const EVENT_AUDIENCES = ['TOUS', 'CHEFS', 'ROLES'] as const
export type EventAudience = (typeof EVENT_AUDIENCES)[number]

export const AUDIENCE_LABELS: Record<EventAudience, string> = {
  TOUS: 'Toute la caravane',
  CHEFS: 'Les chefs',
  ROLES: 'Certains rôles',
}

export const EVENT_TITLE_MAX = 80
export const EVENT_TEXT_MAX = 1000

export interface VisibilityInput {
  audience: string
  /** Rôles de CAP visés quand audience = ROLES. */
  roleIds: string[]
}

/**
 * Qui voit un événement : les chefs voient tout (ils pilotent l'agenda) ;
 * un jeune voit ce qui est pour tous, et ce qui vise un rôle qu'il tient.
 */
export function canSeeEvent(event: VisibilityInput, role: AppRole, heldRoleIds: string[]): boolean {
  if (role === 'CHEF' || role === 'SUPER_ADMIN') return true
  if (event.audience === 'TOUS') return true
  if (event.audience === 'ROLES') return event.roleIds.some((id) => heldRoleIds.includes(id))
  return false
}

/** Clé de jour « 2026-11-09 » à l'heure de Paris, pour ranger les événements dans la grille. */
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export interface MonthCell {
  key: string
  day: number
  inMonth: boolean
}

/** Grille d'un mois, semaines du lundi au dimanche, complétée par les jours voisins. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7 // lundi = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const weeks = Math.ceil((offset + daysInMonth) / 7)

  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1, 1 - offset + i))
    return {
      key: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
    }
  })
}

/** Lit « 2026-11 » ; retombe sur le mois donné par défaut si la saisie est invalide. */
export function parseMonth(raw: string | undefined, fallback: Date): { year: number; month: number } {
  const match = raw?.match(/^(\d{4})-(\d{2})$/)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) return { year, month }
  }
  const [y, m] = dayKey(fallback).split('-').map(Number)
  return { year: y, month: m }
}

export function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Décalage de Paris par rapport à UTC à un instant donné, en millisecondes. */
function parisOffset(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - utcMs
}

/**
 * « 2026-11-14 » + « 09:30 » saisis à l'heure de Paris, en instant UTC.
 * Renvoie null si la date est absente ou mal formée.
 */
export function parisDateTime(date: string, time = ''): Date | null {
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!d) return null
  const t = time.match(/^(\d{2}):(\d{2})$/)
  const naive = Date.UTC(+d[1], +d[2] - 1, +d[3], t ? +t[1] : 0, t ? +t[2] : 0)
  // Deux passes : le décalage peut changer autour d'un passage à l'heure d'été.
  const first = naive - parisOffset(naive)
  return new Date(naive - parisOffset(first))
}
