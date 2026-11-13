import { beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { Actor } from '@/lib/domain/types'
import { awardBadge, awardPoints, revokeBadge } from '@/lib/services/recompenseService'
import { getLedger, getScore } from '@/lib/services/pointsService'
import { createJeunes, deleteUser } from '@/lib/services/userService'
import { createTestDb } from '../helpers/db'

describe('récompenses et comptes', () => {
  let db: PrismaClient
  let admin: Actor
  let chef: Actor
  let jeune: Actor
  let projectId: string
  let badgeId: string

  beforeEach(async () => {
    db = (await createTestDb()).prisma
    const a = await db.user.create({ data: { username: 'admin', displayName: 'Admin', passwordHash: 'x', role: 'SUPER_ADMIN' } })
    const c = await db.user.create({ data: { username: 'sarah', displayName: 'Sarah', passwordHash: 'x', role: 'CHEF' } })
    const j = await db.user.create({ data: { username: 'lucas', displayName: 'Lucas', passwordHash: 'x', role: 'JEUNE' } })
    admin = { id: a.id, role: 'SUPER_ADMIN', displayName: 'Admin' }
    chef = { id: c.id, role: 'CHEF', displayName: 'Sarah' }
    jeune = { id: j.id, role: 'JEUNE', displayName: 'Lucas' }
    projectId = (await db.project.create({ data: { title: 'Camp', status: 'EN_COURS', currentPhase: 'AGIR' } })).id
    badgeId = (
      await db.badge.create({
        data: { code: 'feu', name: 'Gardien du feu', description: 'x', icon: 'x', ruleType: 'MANUEL', points: 10 },
      })
    ).id
  })

  it('un chef remet un écusson avec sa raison, et ses points', async () => {
    await awardBadge(db, chef, { userId: jeune.id, badgeId, reason: 'A tenu le feu tout le camp', projectId })
    const ub = await db.userBadge.findFirst({ where: { userId: jeune.id } })
    expect(ub?.reason).toBe('A tenu le feu tout le camp')
    expect(ub?.awardedById).toBe(chef.id)
    expect(await getScore(db, jeune.id)).toBe(10)
    const notif = await db.notification.findFirst({ where: { userId: jeune.id } })
    expect(notif?.message).toContain('Gardien du feu')
  })

  it('refuse sans raison, en double, ou venant d’un jeune', async () => {
    await expect(awardBadge(db, chef, { userId: jeune.id, badgeId, reason: ' ', projectId })).rejects.toThrow(/pourquoi/)
    await awardBadge(db, chef, { userId: jeune.id, badgeId, reason: 'Bravo !', projectId })
    await expect(awardBadge(db, chef, { userId: jeune.id, badgeId, reason: 'Encore', projectId })).rejects.toThrow(/déjà/)
    await expect(awardPoints(db, jeune, { userId: jeune.id, projectId, amount: 50, reason: 'moi' })).rejects.toThrow()
  })

  it('retirer un écusson retire aussi ses points', async () => {
    await awardBadge(db, chef, { userId: jeune.id, badgeId, reason: 'Bravo !', projectId })
    await revokeBadge(db, chef, jeune.id, badgeId)
    expect(await db.userBadge.count({ where: { userId: jeune.id } })).toBe(0)
    expect(await getScore(db, jeune.id)).toBe(0)
  })

  it('donne et retire des points, avec la raison dans l’historique', async () => {
    await awardPoints(db, chef, { userId: jeune.id, projectId, amount: 25, reason: 'Super vaisselle' })
    await awardPoints(db, chef, { userId: jeune.id, projectId, amount: -5, reason: 'Retard' })
    expect(await getScore(db, jeune.id)).toBe(20)
    const ledger = await getLedger(db, jeune.id)
    expect(ledger.map((l) => l.note).sort()).toEqual(['Retard', 'Super vaisselle'])
    await expect(awardPoints(db, chef, { userId: jeune.id, projectId, amount: 0, reason: 'rien' })).rejects.toThrow()
    await expect(awardPoints(db, chef, { userId: jeune.id, projectId, amount: 9999, reason: 'trop' })).rejects.toThrow()
  })

  it('crée des jeunes en lot avec des identifiants libres', async () => {
    const crees = await createJeunes(db, admin, 'Lucas Martin\nLéa Dupont\n\nlucas martin')
    expect(crees.map((c) => c.username)).toEqual(['lucas.m', 'lea'])
    expect(crees.every((c) => c.tempPassword.length === 12)).toBe(true)
    const lea = await db.user.findUnique({ where: { username: 'lea' } })
    expect(lea?.role).toBe('JEUNE')
    expect(lea?.mustChangePassword).toBe(true)
    await expect(createJeunes(db, chef, 'Tom')).rejects.toThrow()
  })

  it('supprime un chef : ce qu’il a créé passe au super admin', async () => {
    const task = await db.task.create({
      data: { projectId, title: 'Affiche', phase: 'AGIR', difficulty: 'FACILE', status: 'OUVERTE', createdById: chef.id },
    })
    await db.event.create({ data: { title: 'Réunion', startsAt: new Date(), createdById: chef.id } })
    await db.note.create({ data: { title: 'Mot', body: 'x', authorId: chef.id, imageName: 'img.webp' } })
    const fichiers = await deleteUser(db, admin, chef.id)
    expect(fichiers).toEqual(['img.webp'])
    expect(await db.user.findUnique({ where: { id: chef.id } })).toBeNull()
    expect((await db.task.findUnique({ where: { id: task.id } }))?.createdById).toBe(admin.id)
    expect(await db.event.count({ where: { createdById: admin.id } })).toBe(1)
  })

  it('supprime un jeune avec ses rendus, points et écussons', async () => {
    const task = await db.task.create({
      data: { projectId, title: 'Affiche', phase: 'AGIR', difficulty: 'FACILE', status: 'OUVERTE', createdById: chef.id },
    })
    const sub = await db.submission.create({ data: { taskId: task.id, submittedById: jeune.id } })
    await db.attachment.create({
      data: {
        submissionId: sub.id, storedName: 'photo.webp', originalName: 'p.jpg', mimeType: 'image/webp',
        sizeBytes: 1, width: 1, height: 1, uploadedById: jeune.id,
      },
    })
    await awardBadge(db, chef, { userId: jeune.id, badgeId, reason: 'Bravo !', projectId })
    expect(await deleteUser(db, admin, jeune.id)).toEqual(['photo.webp'])
    expect(await db.submission.count()).toBe(0)
    expect(await db.userBadge.count()).toBe(0)
    expect(await db.pointsEntry.count()).toBe(0)
    expect(await db.task.count()).toBe(1)
  })

  it('refuse de se supprimer soi-même, et aux non super admins', async () => {
    await expect(deleteUser(db, admin, admin.id)).rejects.toThrow(/propre compte/)
    await expect(deleteUser(db, chef, jeune.id)).rejects.toThrow()
  })
})
