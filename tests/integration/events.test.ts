import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createEvent, deleteEvent, listEvents, listUpcomingEvents } from '@/lib/services/eventService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('agenda', () => {
  let t: TestDb
  let admin: Actor
  let chef: Actor
  let lucie: Actor
  let tom: Actor
  let tresorierId: string

  const debut = new Date('2026-11-01T00:00:00Z')
  const fin = new Date('2026-12-01T00:00:00Z')
  const titres = async (actor: Actor) => (await listEvents(t.prisma, actor, debut, fin)).map((e) => e.title)

  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    admin = await mk('admin', 'SUPER_ADMIN')
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    tom = await mk('tom', 'JEUNE')
    const projet = await t.prisma.project.create({ data: { title: 'Camp 2027', status: 'EN_COURS' } })
    tresorierId = (
      await t.prisma.projectRole.create({
        data: { projectId: projet.id, name: 'Trésorier', points: 20, holderId: lucie.id },
      })
    ).id
  })
  afterEach(async () => {
    await t.cleanup()
  })

  it('filtre les événements selon le public visé', async () => {
    const quand = new Date('2026-11-14T09:00:00Z')
    await createEvent(t.prisma, admin, { title: 'Week-end', startsAt: quand, audience: 'TOUS' })
    await createEvent(t.prisma, admin, { title: 'Réunion chefs', startsAt: quand, audience: 'CHEFS' })
    await createEvent(t.prisma, chef, { title: 'Point compta', startsAt: quand, audience: 'ROLES', roleIds: [tresorierId] })

    expect(await titres(chef)).toHaveLength(3)
    expect(await titres(lucie)).toEqual(['Week-end', 'Point compta'])
    expect(await titres(tom)).toEqual(['Week-end'])
  })

  it('ne rend un rôle qu’à son titulaire tant que le rôle est ouvert', async () => {
    await createEvent(t.prisma, chef, {
      title: 'Point compta',
      startsAt: new Date('2026-11-20T17:00:00Z'),
      audience: 'ROLES',
      roleIds: [tresorierId],
    })
    await t.prisma.projectRole.update({ where: { id: tresorierId }, data: { closedAt: new Date() } })
    expect(await titres(lucie)).toEqual([])
  })

  it('réserve la gestion de l’agenda aux chefs', async () => {
    await expect(
      createEvent(t.prisma, lucie, { title: 'Fête', startsAt: new Date(), audience: 'TOUS' }),
    ).rejects.toThrow(/chefs/)
    const e = await createEvent(t.prisma, chef, { title: 'Fête', startsAt: new Date(), audience: 'TOUS' })
    await expect(deleteEvent(t.prisma, tom, e.id)).rejects.toThrow(/chefs/)
    await deleteEvent(t.prisma, chef, e.id)
    expect(await t.prisma.event.count()).toBe(0)
  })

  it('valide la saisie', async () => {
    const quand = new Date('2026-11-14T09:00:00Z')
    await expect(createEvent(t.prisma, chef, { title: ' ', startsAt: quand, audience: 'TOUS' })).rejects.toThrow(/titre/)
    await expect(
      createEvent(t.prisma, chef, { title: 'X', startsAt: quand, endsAt: new Date('2026-11-13T00:00:00Z'), audience: 'TOUS' }),
    ).rejects.toThrow(/fin/)
    await expect(createEvent(t.prisma, chef, { title: 'X', startsAt: quand, audience: 'ROLES', roleIds: [] })).rejects.toThrow(
      /rôle/,
    )
    await expect(createEvent(t.prisma, chef, { title: 'X', startsAt: quand, audience: 'AMIS' })).rejects.toThrow(/pour qui/)
  })

  it('garde un événement de plusieurs jours visible sur tout l’intervalle', async () => {
    await createEvent(t.prisma, chef, {
      title: 'Camp',
      startsAt: new Date('2026-10-30T08:00:00Z'),
      endsAt: new Date('2026-11-02T16:00:00Z'),
      audience: 'TOUS',
    })
    expect(await titres(tom)).toEqual(['Camp'])
  })

  it('liste les prochains événements à partir de maintenant', async () => {
    const now = new Date('2026-11-10T12:00:00Z')
    await createEvent(t.prisma, chef, { title: 'Passé', startsAt: new Date('2026-11-01T10:00:00Z'), audience: 'TOUS' })
    await createEvent(t.prisma, chef, { title: 'B', startsAt: new Date('2026-11-21T10:00:00Z'), audience: 'TOUS' })
    await createEvent(t.prisma, chef, { title: 'A', startsAt: new Date('2026-11-12T10:00:00Z'), audience: 'TOUS' })
    const prochains = await listUpcomingEvents(t.prisma, tom, 5, now)
    expect(prochains.map((e) => e.title)).toEqual(['A', 'B'])
  })
})
