// tests/integration/badges.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectStats, refreshBadges } from '@/lib/services/badgeService'
import { getScore } from '@/lib/services/pointsService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('badges', () => {
  let t: TestDb
  let userId: string
  let projectId: string

  beforeEach(async () => {
    t = await createTestDb()
    userId = (await t.prisma.user.create({ data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' } })).id
    projectId = (await t.prisma.project.create({ data: { title: 'Camp 2027' } })).id
    await t.prisma.badge.createMany({
      data: [
        { code: 'premier_pas', name: 'Premier pas', description: '1re tâche validée', icon: '🌱', ruleType: 'TACHES_VALIDEES', threshold: 1, points: 5 },
        { code: 'costaud', name: 'Costaud', description: 'une tâche difficile', icon: '💪', ruleType: 'TACHE_DIFFICILE', threshold: 1, points: 10 },
        { code: 'debut_fin', name: 'Du début à la fin', description: 'les 3 phases', icon: '🧭', ruleType: 'TOUTES_PHASES', threshold: 3, points: 20 },
      ],
    })
  })
  afterEach(async () => { await t.cleanup() })

  async function tacheTerminee(phase: string, difficulty: string, autreParticipant = false) {
    const task = await t.prisma.task.create({
      data: { projectId, title: `Tâche ${phase}`, phase, difficulty, status: 'TERMINEE', createdById: userId },
    })
    await t.prisma.taskAssignment.create({ data: { taskId: task.id, userId } })
    if (autreParticipant) {
      const autre = await t.prisma.user.create({
        data: { username: `u${Math.random()}`, displayName: 'Autre', passwordHash: 'x', role: 'JEUNE' },
      })
      await t.prisma.taskAssignment.create({ data: { taskId: task.id, userId: autre.id } })
    }
    return task
  }

  it('compte les tâches validées, difficiles et en équipe', async () => {
    await tacheTerminee('CHOISIR', 'FACILE')
    await tacheTerminee('AGIR', 'DIFFICILE', true)

    const stats = await collectStats(t.prisma, userId)
    expect(stats.validatedTaskCount).toBe(2)
    expect(stats.hardValidatedTaskCount).toBe(1)
    expect(stats.teamValidatedTaskCount).toBe(1)
    expect(stats.phasesByProject[projectId].sort()).toEqual(['AGIR', 'CHOISIR'])
  })

  it('ne compte que les tâches terminées', async () => {
    const task = await t.prisma.task.create({
      data: { projectId, title: 'En cours', phase: 'AGIR', difficulty: 'MOYEN', status: 'EN_COURS', createdById: userId },
    })
    await t.prisma.taskAssignment.create({ data: { taskId: task.id, userId } })
    expect((await collectStats(t.prisma, userId)).validatedTaskCount).toBe(0)
  })

  it('arrête la série sans refus au premier refus', async () => {
    const task = await tacheTerminee('AGIR', 'MOYEN')
    await t.prisma.submission.create({
      data: { taskId: task.id, submittedById: userId, decision: 'REFUSEE', reviewedAt: new Date(Date.now() - 2000) },
    })
    await t.prisma.submission.create({
      data: { taskId: task.id, submittedById: userId, decision: 'ACCEPTEE', reviewedAt: new Date(Date.now() - 1000) },
    })
    expect((await collectStats(t.prisma, userId)).cleanStreak).toBe(1)
  })

  it('débloque un badge, crédite ses points et notifie', async () => {
    await tacheTerminee('CHOISIR', 'DIFFICILE')

    const codes = await refreshBadges(t.prisma, userId, projectId)
    expect(codes.sort()).toEqual(['costaud', 'premier_pas'])
    expect(await getScore(t.prisma, userId)).toBe(15)
    expect(await t.prisma.notification.count({ where: { userId, type: 'BADGE' } })).toBe(2)
  })

  it('ne redonne jamais deux fois le même badge', async () => {
    await tacheTerminee('CHOISIR', 'FACILE')
    await refreshBadges(t.prisma, userId, projectId)
    expect(await refreshBadges(t.prisma, userId, projectId)).toEqual([])
    expect(await getScore(t.prisma, userId)).toBe(5)
  })

  it('exige les trois phases du même projet pour « du début à la fin »', async () => {
    await tacheTerminee('CHOISIR', 'FACILE')
    await tacheTerminee('AGIR', 'FACILE')
    expect(await refreshBadges(t.prisma, userId, projectId)).toEqual(['premier_pas'])

    await tacheTerminee('PARTAGER', 'FACILE')
    expect(await refreshBadges(t.prisma, userId, projectId)).toEqual(['debut_fin'])
  })
})
