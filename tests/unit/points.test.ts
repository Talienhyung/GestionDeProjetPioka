// tests/unit/points.test.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALE, computeTaskAward, maxBonus, parseScale } from '@/lib/domain/points'

describe('computeTaskAward', () => {
  it('donne le socle entier à un participant seul', () => {
    expect(computeTaskAward('FACILE', 1, 0)).toBe(10)
    expect(computeTaskAward('MOYEN', 1, 0)).toBe(25)
    expect(computeTaskAward('DIFFICILE', 1, 0)).toBe(50)
  })

  it('partage le socle en arrondissant au supérieur', () => {
    expect(computeTaskAward('MOYEN', 2, 0)).toBe(13)
    expect(computeTaskAward('MOYEN', 3, 0)).toBe(9)
    expect(computeTaskAward('FACILE', 4, 0)).toBe(3)
  })

  it('ajoute le bonus intégralement à chaque participant', () => {
    expect(computeTaskAward('MOYEN', 2, 5)).toBe(18)
  })

  it('plafonne le bonus au socle de la tâche', () => {
    expect(computeTaskAward('FACILE', 1, 999)).toBe(20)
    expect(maxBonus('FACILE')).toBe(10)
  })

  it('refuse un bonus négatif et un nombre de participants invalide', () => {
    expect(() => computeTaskAward('FACILE', 1, -1)).toThrow(/bonus/i)
    expect(() => computeTaskAward('FACILE', 0, 0)).toThrow(/participant/i)
  })

  it('respecte un barème personnalisé', () => {
    expect(computeTaskAward('FACILE', 2, 0, { FACILE: 7, MOYEN: 20, DIFFICILE: 40 })).toBe(4)
  })
})

describe('parseScale', () => {
  it('rend le barème par défaut si le réglage est absent ou illisible', () => {
    expect(parseScale(null)).toEqual(DEFAULT_SCALE)
    expect(parseScale('pas du json')).toEqual(DEFAULT_SCALE)
    expect(parseScale('{"FACILE": 5}')).toEqual(DEFAULT_SCALE)
  })

  it('lit un barème complet et valide', () => {
    expect(parseScale('{"FACILE":5,"MOYEN":15,"DIFFICILE":30}')).toEqual({
      FACILE: 5, MOYEN: 15, DIFFICILE: 30,
    })
  })
})
