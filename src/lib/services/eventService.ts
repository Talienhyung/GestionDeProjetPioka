import type { Db } from '@/lib/db'
import {
  EVENT_AUDIENCES,
  EVENT_TEXT_MAX,
  EVENT_TITLE_MAX,
  type EventAudience,
  canSeeEvent,
} from '@/lib/domain/agenda'
import type { Actor } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

export interface EventInput {
  title: string
  description?: string
  location?: string
  startsAt: Date
  endsAt?: Date | null
  allDay?: boolean
  audience: string
  /** Rôles de CAP visés, quand audience = ROLES. */
  roleIds?: string[]
}

const avecRoles = {
  roles: { include: { projectRole: { select: { id: true, name: true, project: { select: { title: true } } } } } },
} as const

function assertOrganisateur(actor: Actor) {
  if (!isChef(actor)) throw new ForbiddenError('Seuls les chefs peuvent gérer l’agenda.')
}

/** Rôles de CAP en cours que l'acteur tient : ce sont eux qui ouvrent les événements « par rôle ». */
async function heldRoleIds(db: Db, userId: string): Promise<string[]> {
  const roles = await db.projectRole.findMany({ where: { holderId: userId, closedAt: null }, select: { id: true } })
  return roles.map((r) => r.id)
}

export async function createEvent(db: Db, actor: Actor, input: EventInput) {
  assertOrganisateur(actor)

  const title = input.title.trim()
  const description = (input.description ?? '').trim()
  const location = (input.location ?? '').trim()
  const audience = input.audience as EventAudience
  const roleIds = [...new Set(input.roleIds ?? [])]

  if (!title) throw new ValidationError('Donne un titre à l’événement.')
  if (title.length > EVENT_TITLE_MAX) throw new ValidationError(`Le titre ne peut pas dépasser ${EVENT_TITLE_MAX} caractères.`)
  if (description.length > EVENT_TEXT_MAX) throw new ValidationError(`La description ne peut pas dépasser ${EVENT_TEXT_MAX} caractères.`)
  if (Number.isNaN(input.startsAt.getTime())) throw new ValidationError('La date de début est invalide.')
  if (input.endsAt && input.endsAt < input.startsAt) throw new ValidationError('La fin ne peut pas précéder le début.')
  if (!EVENT_AUDIENCES.includes(audience)) throw new ValidationError('Choisis pour qui est l’événement.')
  if (audience === 'ROLES') {
    if (roleIds.length === 0) throw new ValidationError('Choisis au moins un rôle.')
    const trouves = await db.projectRole.count({ where: { id: { in: roleIds } } })
    if (trouves !== roleIds.length) throw new ValidationError('Un des rôles choisis n’existe plus.')
  }

  return db.event.create({
    data: {
      title,
      description,
      location,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      allDay: input.allDay ?? false,
      audience,
      createdById: actor.id,
      roles: audience === 'ROLES' ? { create: roleIds.map((projectRoleId) => ({ projectRoleId })) } : undefined,
    },
    include: avecRoles,
  })
}

export async function deleteEvent(db: Db, actor: Actor, eventId: string) {
  assertOrganisateur(actor)
  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) throw new NotFoundError('Événement')
  await db.event.delete({ where: { id: eventId } })
}

/** Événements visibles par l'acteur, qui recoupent l'intervalle [from, to[. */
export async function listEvents(db: Db, actor: Actor, from: Date, to: Date) {
  const [events, held] = await Promise.all([
    db.event.findMany({
      where: {
        startsAt: { lt: to },
        OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }],
      },
      orderBy: { startsAt: 'asc' },
      include: avecRoles,
    }),
    heldRoleIds(db, actor.id),
  ])

  return events.filter((event) =>
    canSeeEvent({ audience: event.audience, roleIds: event.roles.map((r) => r.projectRoleId) }, actor.role, held),
  )
}

/** Les prochains événements visibles, à partir de maintenant. */
export async function listUpcomingEvents(db: Db, actor: Actor, limit = 3, now = new Date()) {
  const horizon = new Date(now.getTime() + 366 * 24 * 3600 * 1000)
  const events = await listEvents(db, actor, now, horizon)
  return events.slice(0, limit)
}

/** Rôles proposés dans le formulaire : ceux des CAP pas encore archivés. */
export async function listAssignableRoles(db: Db) {
  return db.projectRole.findMany({
    where: { closedAt: null, project: { status: { not: 'ARCHIVE' } } },
    orderBy: [{ project: { title: 'asc' } }, { name: 'asc' }],
    select: { id: true, name: true, holder: { select: { displayName: true } }, project: { select: { title: true } } },
  })
}

export type AgendaEvent = Awaited<ReturnType<typeof listEvents>>[number]
