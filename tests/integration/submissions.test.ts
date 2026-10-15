// tests/integration/submissions.test.ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createProject } from '@/lib/services/projectService'
import { getScore } from '@/lib/services/pointsService'
import { AlreadyReviewedError, cancelValidation, reviewSubmission, submitTask } from '@/lib/services/submissionService'
import { createTask, joinTask, removeParticipant } from '@/lib/services/taskService'
import { createTestDb, type TestDb } from '../helpers/db'

async function photo(): Promise<Buffer> {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: '#2b7' } }).jpeg().toBuffer()
}

describe('soumission et revue', () => {
  let t: TestDb
  let dir: string
  let chef: Actor
  let lucie: Actor
  let tom: Actor
  let projectId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cap-sub-'))
    process.env.UPLOAD_DIR = dir
    t = createTestDb()

    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    tom = await mk('tom', 'JEUNE')
    projectId = (await createProject(t.prisma, chef, { title: 'Camp 2027' })).id

    await t.prisma.badge.create({
      data: { code: 'premier_pas', name: 'Premier pas', description: '1re tâche', icon: '🌱', ruleType: 'TACHES_VALIDEES', threshold: 1, points: 5 },
    })
  })
  afterEach(async () => {
    await t.cleanup()
    rmSync(dir, { recursive: true, force: true })
  })

  async function tachePrete(difficulty = 'MOYEN' as const, participants: Actor[] = [lucie]) {
    const task = await createTask(t.prisma, chef, { projectId, title: 'Budget', phase: 'AGIR', difficulty })
    for (const p of participants) await joinTask(t.prisma, p, task.id)
    return task
  }

  it('enregistre la soumission, ses photos, et passe la tâche en SOUMISE', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, {
      taskId: task.id,
      message: 'Budget bouclé',
      photos: [{ buffer: await photo(), originalName: 'budget.jpg' }],
    })

    expect((await t.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('SOUMISE')
    expect(await t.prisma.attachment.count({ where: { submissionId } })).toBe(1)
    expect(await t.prisma.notification.count({ where: { userId: chef.id, type: 'SOUMISSION' } })).toBe(1)
  })

  it('refuse la soumission par un jeune non inscrit', async () => {
    const task = await tachePrete()
    await expect(submitTask(t.prisma, tom, { taskId: task.id, message: '', photos: [] })).rejects.toThrow()
  })

  it('refuse une quatrième photo sans rien écrire sur le disque', async () => {
    const task = await tachePrete()
    const img = await photo()
    await expect(
      submitTask(t.prisma, lucie, {
        taskId: task.id,
        message: '',
        photos: Array.from({ length: 4 }, (_, i) => ({ buffer: img, originalName: `p${i}.jpg` })),
      }),
    ).rejects.toThrow(/3 photos/)
    expect(await t.prisma.attachment.count()).toBe(0)
  })

  it('valide : crédite les points, termine la tâche, débloque les badges, notifie', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: 'fini', photos: [] })

    const result = await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE', bonus: 5 })

    expect(result.taskStatus).toBe('TERMINEE')
    expect(result.awarded).toEqual([{ userId: lucie.id, amount: 30 }])
    expect(result.newBadges).toEqual([{ userId: lucie.id, codes: ['premier_pas'] }])
    expect(await getScore(t.prisma, lucie.id)).toBe(35) // 25 + 5 de bonus + 5 du badge
    expect(await t.prisma.notification.count({ where: { userId: lucie.id, type: 'TACHE_VALIDEE' } })).toBe(1)
  })

  it('partage les points entre les participants, arrondi au supérieur', async () => {
    const task = await tachePrete('MOYEN', [lucie, tom])
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    const result = await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })

    expect(result.awarded.map((a) => a.amount)).toEqual([13, 13])
  })

  // Review Focus 3
  it('partage selon les participants présents AU MOMENT de la validation', async () => {
    const task = await tachePrete('MOYEN', [lucie, tom])
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await removeParticipant(t.prisma, chef, task.id, tom.id)

    const result = await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })

    expect(result.awarded).toEqual([{ userId: lucie.id, amount: 25 }])
    expect(await getScore(t.prisma, tom.id)).toBe(0)
  })

  it('refuse de valider une tâche dont tous les participants ont été retirés', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await removeParticipant(t.prisma, chef, task.id, lucie.id)

    await expect(reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' }))
      .rejects.toThrow(/participant/i)
  })

  // Review Focus 1
  it('refuse une seconde revue de la même soumission, sans recréditer', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })

    await expect(reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' }))
      .rejects.toBeInstanceOf(AlreadyReviewedError)
    expect(await getScore(t.prisma, lucie.id)).toBe(30) // 25 + 5 du badge, pas davantage
  })

  it('exige un commentaire pour refuser, et remet la tâche à corriger', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    await expect(reviewSubmission(t.prisma, chef, { submissionId, decision: 'REFUSEE', comment: '   ' }))
      .rejects.toThrow(/commentaire/i)

    const result = await reviewSubmission(t.prisma, chef, {
      submissionId, decision: 'REFUSEE', comment: 'Il manque les recettes.',
    })
    expect(result.taskStatus).toBe('A_CORRIGER')
    expect(await getScore(t.prisma, lucie.id)).toBe(0)
    expect(await t.prisma.notification.count({ where: { userId: lucie.id, type: 'TACHE_REFUSEE' } })).toBe(1)
  })

  it('permet de resoumettre après un refus', async () => {
    const task = await tachePrete()
    const first = await submitTask(t.prisma, lucie, { taskId: task.id, message: 'v1', photos: [] })
    await reviewSubmission(t.prisma, chef, { submissionId: first.submissionId, decision: 'REFUSEE', comment: 'à revoir' })

    const second = await submitTask(t.prisma, lucie, { taskId: task.id, message: 'v2', photos: [] })
    const result = await reviewSubmission(t.prisma, chef, { submissionId: second.submissionId, decision: 'ACCEPTEE' })

    expect(result.taskStatus).toBe('TERMINEE')
    expect(await t.prisma.submission.count({ where: { taskId: task.id } })).toBe(2)
  })

  it('refuse qu un jeune valide une soumission', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await expect(reviewSubmission(t.prisma, tom, { submissionId, decision: 'ACCEPTEE' })).rejects.toThrow()
  })

  it('annule une validation : points repris, tâche à corriger', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })

    await cancelValidation(t.prisma, chef, task.id)

    expect((await t.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('A_CORRIGER')
    expect(await getScore(t.prisma, lucie.id)).toBe(5) // les points de la tâche repris, le badge reste
  })

  it('refuse une seconde soumission tant que la première attend un chef', async () => {
    const task = await tachePrete('MOYEN', [lucie, tom])
    await submitTask(t.prisma, lucie, { taskId: task.id, message: 'v1', photos: [] })

    await expect(submitTask(t.prisma, tom, { taskId: task.id, message: 'doublon', photos: [] }))
      .rejects.toThrow(/attend la réponse/i)
    expect(await t.prisma.submission.count({ where: { taskId: task.id } })).toBe(1)
  })

  it('enregistre le bonus plafonné, celui qui a réellement été crédité', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE', bonus: 9999 })

    const submission = await t.prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })
    expect(submission.bonusPoints).toBe(25)
    expect(await getScore(t.prisma, lucie.id)).toBe(55) // 25 + 25 de bonus plafonné + 5 du badge
  })

  it('ne reprend que les points de la dernière validation quand on annule deux fois', async () => {
    const task = await tachePrete()

    const a = await submitTask(t.prisma, lucie, { taskId: task.id, message: 'v1', photos: [] })
    await reviewSubmission(t.prisma, chef, { submissionId: a.submissionId, decision: 'ACCEPTEE' })
    await cancelValidation(t.prisma, chef, task.id)

    const b = await submitTask(t.prisma, lucie, { taskId: task.id, message: 'v2', photos: [] })
    await reviewSubmission(t.prisma, chef, { submissionId: b.submissionId, decision: 'ACCEPTEE' })
    await cancelValidation(t.prisma, chef, task.id)

    expect(await getScore(t.prisma, lucie.id)).toBe(5) // il ne reste que le badge
  })

  it('ne crédite qu une fois si deux revues partent en même temps', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    const issues = await Promise.allSettled([
      reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' }),
      reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' }),
    ])

    expect(issues.filter((issue) => issue.status === 'fulfilled')).toHaveLength(1)
    expect(await t.prisma.pointsEntry.count({ where: { submissionId, reason: 'TACHE' } })).toBe(1)
    expect(await getScore(t.prisma, lucie.id)).toBe(30)
  })
})
