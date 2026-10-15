// tests/unit/throttle.test.ts
import { describe, expect, it } from 'vitest'
import { LoginThrottle } from '@/lib/auth/throttle'

describe('LoginThrottle', () => {
  it('laisse passer tant que le quota n est pas atteint', () => {
    const t = new LoginThrottle(3, 60_000)
    t.registerFailure('lucie', 0)
    t.registerFailure('lucie', 1_000)
    expect(t.isBlocked('lucie', 2_000)).toBe(false)
  })

  it('bloque au delà du quota dans la fenêtre', () => {
    const t = new LoginThrottle(3, 60_000)
    for (let i = 0; i < 3; i += 1) t.registerFailure('lucie', i * 1_000)
    expect(t.isBlocked('lucie', 4_000)).toBe(true)
  })

  it('oublie les échecs sortis de la fenêtre', () => {
    const t = new LoginThrottle(3, 60_000)
    for (let i = 0; i < 3; i += 1) t.registerFailure('lucie', i * 1_000)
    expect(t.isBlocked('lucie', 120_000)).toBe(false)
  })

  it('ignore la casse de l identifiant', () => {
    const t = new LoginThrottle(2, 60_000)
    t.registerFailure('Lucie', 0)
    t.registerFailure('LUCIE', 10)
    expect(t.isBlocked('lucie', 20)).toBe(true)
  })

  it('remet le compteur à zéro après une connexion réussie', () => {
    const t = new LoginThrottle(2, 60_000)
    t.registerFailure('lucie', 0)
    t.reset('lucie')
    t.registerFailure('lucie', 10)
    expect(t.isBlocked('lucie', 20)).toBe(false)
  })

  it('ne bloque pas les autres comptes', () => {
    const t = new LoginThrottle(1, 60_000)
    t.registerFailure('lucie', 0)
    expect(t.isBlocked('tom', 10)).toBe(false)
  })
})
