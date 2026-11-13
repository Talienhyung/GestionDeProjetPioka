import { beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { Actor } from '@/lib/domain/types'
import { createGroupe, deleteGroupe, listGroupes, setGroupe, updateGroupe } from '@/lib/services/groupeService'
import { createJeunes } from '@/lib/services/userService'
import { createTestDb } from '../helpers/db'

describe('groupes', () => {
  let db: PrismaClient
  let admin: Actor
  let chef: Actor
  let jeune: Actor

  beforeEach(async () => {
    db = (await createTestDb()).prisma
    const a = await db.user.create({ data: { username: 'admin', displayName: 'Admin', passwordHash: 'x', role: 'SUPER_ADMIN' } })
    const c = await db.user.create({ data: { username: 'sarah', displayName: 'Sarah', passwordHash: 'x', role: 'CHEF' } })
    const j = await db.user.create({ data: { username: 'lucas', displayName: 'Lucas', passwordHash: 'x', role: 'JEUNE' } })
    admin = { id: a.id, role: 'SUPER_ADMIN', displayName: 'Admin' }
    chef = { id: c.id, role: 'CHEF', displayName: 'Sarah' }
    jeune = { id: j.id, role: 'JEUNE', displayName: 'Lucas' }
  })

  it('un chef crée, renomme et compose un groupe', async () => {
    const g = await createGroupe(db, chef, { name: '  Les  Loups ', color: '#D03F15' })
    expect(g.name).toBe('Les Loups')
    expect(g.color).toBe('#d03f15')
    await setGroupe(db, chef, jeune.id, g.id)
    let liste = await listGroupes(db)
    expect(liste.groupes[0].membres.map((m) => m.id)).toEqual([jeune.id])
    expect(liste.sansGroupe).toEqual([])
    await updateGroupe(db, chef, g.id, { name: 'Les Aigles' })
    await setGroupe(db, chef, jeune.id, null)
    liste = await listGroupes(db)
    expect(liste.groupes[0].name).toBe('Les Aigles')
    expect(liste.sansGroupe.map((m) => m.id)).toEqual([jeune.id])
  })

  it('refuse les doublons de nom et les jeunes', async () => {
    await createGroupe(db, chef, { name: 'Loups' })
    await expect(createGroupe(db, admin, { name: 'loups' })).rejects.toThrow(/déjà/)
    await expect(createGroupe(db, jeune, { name: 'Moi' })).rejects.toThrow()
  })

  it('supprimer un groupe laisse ses jeunes sans groupe', async () => {
    const g = await createGroupe(db, chef, { name: 'Loups' })
    await setGroupe(db, chef, jeune.id, g.id)
    await deleteGroupe(db, chef, g.id)
    expect((await db.user.findUnique({ where: { id: jeune.id } }))?.groupeId).toBeNull()
  })

  it('les comptes créés en lot peuvent arriver dans un groupe', async () => {
    const g = await createGroupe(db, chef, { name: 'Loups' })
    await createJeunes(db, admin, 'Tom Petit\nInès Roux', g.id)
    expect((await listGroupes(db)).groupes[0].membres.map((m) => m.displayName)).toEqual(['Inès Roux', 'Tom Petit'])
  })
})
