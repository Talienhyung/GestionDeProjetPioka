// tests/unit/agenda.test.ts
import { describe, expect, it } from 'vitest'
import { canSeeEvent, dayKey, monthGrid, parisDateTime, parseMonth, shiftMonth } from '@/lib/domain/agenda'
import { badgeReason } from '@/lib/domain/badgeReasons'

describe('canSeeEvent', () => {
  const pourTous = { audience: 'TOUS', roleIds: [] }
  const pourChefs = { audience: 'CHEFS', roleIds: [] }
  const pourTresorier = { audience: 'ROLES', roleIds: ['tresorier'] }

  it('montre tout aux chefs et au super admin', () => {
    for (const e of [pourTous, pourChefs, pourTresorier]) {
      expect(canSeeEvent(e, 'CHEF', [])).toBe(true)
      expect(canSeeEvent(e, 'SUPER_ADMIN', [])).toBe(true)
    }
  })

  it('montre à un jeune ce qui est pour tous, et ses rôles seulement', () => {
    expect(canSeeEvent(pourTous, 'JEUNE', [])).toBe(true)
    expect(canSeeEvent(pourChefs, 'JEUNE', ['tresorier'])).toBe(false)
    expect(canSeeEvent(pourTresorier, 'JEUNE', [])).toBe(false)
    expect(canSeeEvent(pourTresorier, 'JEUNE', ['intendant', 'tresorier'])).toBe(true)
  })
})

describe('calendrier', () => {
  it('range les dates au jour de Paris', () => {
    // 23 h 30 UTC le 9 = 0 h 30 le 10 à Paris (heure d'hiver)
    expect(dayKey(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-10')
  })

  it('construit des semaines complètes du lundi au dimanche', () => {
    const grid = monthGrid(2026, 11) // 1er novembre 2026 : un dimanche
    expect(grid.length % 7).toBe(0)
    expect(grid[0]).toEqual({ key: '2026-10-26', day: 26, inMonth: false })
    expect(grid[6]).toEqual({ key: '2026-11-01', day: 1, inMonth: true })
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30)
  })

  it('lit et décale les mois', () => {
    expect(parseMonth('2027-02', new Date())).toEqual({ year: 2027, month: 2 })
    expect(parseMonth('n’importe', new Date('2026-11-09T12:00:00Z'))).toEqual({ year: 2026, month: 11 })
    expect(shiftMonth(2026, 12, 1)).toBe('2027-01')
    expect(shiftMonth(2026, 1, -1)).toBe('2025-12')
  })
})

describe('parisDateTime', () => {
  it('convertit une saisie à l’heure de Paris, hiver comme été', () => {
    expect(parisDateTime('2026-11-14', '09:30')?.toISOString()).toBe('2026-11-14T08:30:00.000Z')
    expect(parisDateTime('2026-07-14', '22:00')?.toISOString()).toBe('2026-07-14T20:00:00.000Z')
    expect(parisDateTime('2026-11-14')?.toISOString()).toBe('2026-11-13T23:00:00.000Z')
    expect(parisDateTime('14/11/2026', '09:30')).toBeNull()
  })
})

describe('badgeReason', () => {
  it('explique chaque règle avec son seuil', () => {
    expect(badgeReason('TACHES_VALIDEES', 1)).toMatch(/première tâche/)
    expect(badgeReason('TACHES_VALIDEES', 5)).toMatch(/5 tâches/)
    expect(badgeReason('SOUMISSIONS_AVEC_PHOTO', 5)).toMatch(/5 travaux avec une photo/)
    expect(badgeReason('INCONNU', 3)).toMatch(/condition/)
  })
})
