// tests/unit/tasks.test.ts
import { describe, expect, it } from 'vitest'
import { TaskTransitionError, canPerform, nextStatus, type TaskContext } from '@/lib/domain/tasks'

const base: TaskContext = {
  status: 'OUVERTE',
  participantCount: 0,
  hasSubmission: false,
  projectArchived: false,
  isParticipant: false,
  actorRole: 'JEUNE',
}

const ctx = (over: Partial<TaskContext> = {}): TaskContext => ({ ...base, ...over })

describe('inscription', () => {
  it('fait passer une tâche ouverte en cours', () => {
    expect(nextStatus(ctx(), 'S_INSCRIRE')).toBe('EN_COURS')
  })

  it('laisse en cours une tâche qui a déjà des participants', () => {
    expect(nextStatus(ctx({ status: 'EN_COURS', participantCount: 1 }), 'S_INSCRIRE')).toBe('EN_COURS')
  })

  it('refuse de s inscrire sur une tâche terminée ou soumise', () => {
    expect(canPerform(ctx({ status: 'TERMINEE' }), 'S_INSCRIRE')).toBe(false)
    expect(canPerform(ctx({ status: 'SOUMISE', participantCount: 1 }), 'S_INSCRIRE')).toBe(false)
  })

  it('autorise à reprendre une tâche à corriger', () => {
    expect(canPerform(ctx({ status: 'A_CORRIGER', participantCount: 1 }), 'S_INSCRIRE')).toBe(true)
  })
})

describe('désinscription', () => {
  it('rouvre la tâche quand le dernier participant part', () => {
    expect(nextStatus(ctx({ status: 'EN_COURS', participantCount: 1, isParticipant: true }), 'SE_DESINSCRIRE'))
      .toBe('OUVERTE')
  })

  it('garde la tâche en cours s il reste des participants', () => {
    expect(nextStatus(ctx({ status: 'EN_COURS', participantCount: 3, isParticipant: true }), 'SE_DESINSCRIRE'))
      .toBe('EN_COURS')
  })

  it('refuse la désinscription dès qu une soumission existe', () => {
    const c = ctx({ status: 'A_CORRIGER', participantCount: 2, isParticipant: true, hasSubmission: true })
    expect(canPerform(c, 'SE_DESINSCRIRE')).toBe(false)
  })

  it('refuse la désinscription à qui n est pas participant', () => {
    expect(canPerform(ctx({ status: 'EN_COURS', participantCount: 1 }), 'SE_DESINSCRIRE')).toBe(false)
  })

  it('laisse un chef retirer un participant même après soumission', () => {
    const c = ctx({ status: 'SOUMISE', participantCount: 2, hasSubmission: true, actorRole: 'CHEF' })
    expect(nextStatus(c, 'RETIRER_PARTICIPANT')).toBe('SOUMISE')
  })
})

describe('soumission et revue', () => {
  it('soumet une tâche en cours', () => {
    expect(nextStatus(ctx({ status: 'EN_COURS', participantCount: 1, isParticipant: true }), 'SOUMETTRE'))
      .toBe('SOUMISE')
  })

  it('resoumet une tâche à corriger', () => {
    const c = ctx({ status: 'A_CORRIGER', participantCount: 1, isParticipant: true, hasSubmission: true })
    expect(nextStatus(c, 'SOUMETTRE')).toBe('SOUMISE')
  })

  it('refuse la soumission par un non participant', () => {
    expect(canPerform(ctx({ status: 'EN_COURS', participantCount: 1 }), 'SOUMETTRE')).toBe(false)
  })

  it('valide et refuse une soumission, réservé aux chefs', () => {
    const c = ctx({ status: 'SOUMISE', participantCount: 1, hasSubmission: true, actorRole: 'CHEF' })
    expect(nextStatus(c, 'VALIDER')).toBe('TERMINEE')
    expect(nextStatus(c, 'REFUSER')).toBe('A_CORRIGER')
    expect(canPerform({ ...c, actorRole: 'JEUNE' }, 'VALIDER')).toBe(false)
  })

  it('permet à un chef d annuler une validation', () => {
    const c = ctx({ status: 'TERMINEE', participantCount: 1, hasSubmission: true, actorRole: 'CHEF' })
    expect(nextStatus(c, 'ANNULER_VALIDATION')).toBe('A_CORRIGER')
  })
})

describe('propositions', () => {
  it('accepte et refuse une proposition, réservé aux chefs', () => {
    const c = ctx({ status: 'PROPOSEE', actorRole: 'CHEF' })
    expect(nextStatus(c, 'ACCEPTER_PROPOSITION')).toBe('OUVERTE')
    expect(nextStatus(c, 'REFUSER_PROPOSITION')).toBe('REJETEE')
    expect(canPerform({ ...c, actorRole: 'JEUNE' }, 'ACCEPTER_PROPOSITION')).toBe(false)
  })

  it('refuse toute inscription sur une tâche encore proposée', () => {
    expect(canPerform(ctx({ status: 'PROPOSEE' }), 'S_INSCRIRE')).toBe(false)
  })
})

describe('projet archivé', () => {
  it('interdit toute action, y compris aux chefs', () => {
    const c = ctx({ status: 'OUVERTE', projectArchived: true, actorRole: 'CHEF' })
    expect(canPerform(c, 'S_INSCRIRE')).toBe(false)
    expect(canPerform(c, 'VALIDER')).toBe(false)
    expect(() => nextStatus(c, 'S_INSCRIRE')).toThrow(TaskTransitionError)
  })
})

describe('nextStatus', () => {
  it('lève une erreur explicite sur une transition interdite', () => {
    expect(() => nextStatus(ctx({ status: 'TERMINEE' }), 'SOUMETTRE')).toThrow(TaskTransitionError)
    expect(() => nextStatus(ctx({ status: 'TERMINEE' }), 'SOUMETTRE')).toThrow(/TERMINEE/)
  })
})
