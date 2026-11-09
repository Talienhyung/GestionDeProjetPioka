// tests/unit/stretchGoals.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeGoals, parseStretchGoals, stretchProgress } from '@/lib/domain/stretchGoals'

const GOALS = [
  { amountCents: 100000, label: 'Le grand voyage' },
  { amountCents: 25000, label: 'Le train' },
  { amountCents: 50000, label: 'Les tentes' },
]

describe('normalizeGoals', () => {
  it('trie par montant et écarte les paliers invalides ou en double', () => {
    const goals = normalizeGoals([
      ...GOALS,
      { amountCents: 25000, label: 'doublon' },
      { amountCents: 0, label: 'zéro' },
      { amountCents: 12.5, label: 'pas entier' },
    ])
    expect(goals.map((g) => g.amountCents)).toEqual([25000, 50000, 100000])
    expect(goals[0].label).toBe('Le train')
  })
})

describe('parseStretchGoals', () => {
  it('rend une liste vide pour une valeur absente ou cassée', () => {
    expect(parseStretchGoals(null)).toEqual([])
    expect(parseStretchGoals('pas du json')).toEqual([])
    expect(parseStretchGoals('{"a":1}')).toEqual([])
  })

  it('relit ce qui a été enregistré', () => {
    expect(parseStretchGoals(JSON.stringify(GOALS))).toHaveLength(3)
  })
})

describe('stretchProgress', () => {
  it('place les fanions proportionnellement au dernier palier', () => {
    const p = stretchProgress(0, GOALS)
    expect(p.markers.map((m) => m.percent)).toEqual([25, 50, 100])
    expect(p.percent).toBe(0)
    expect(p.next?.label).toBe('Le train')
    expect(p.remainingCents).toBe(25000)
  })

  it('compte les paliers atteints et vise le suivant', () => {
    const p = stretchProgress(33750, GOALS)
    expect(p.percent).toBeCloseTo(33.75)
    expect(p.reachedCount).toBe(1)
    expect(p.next?.label).toBe('Les tentes')
    expect(p.remainingCents).toBe(16250)
  })

  it('reste pleine au-delà du dernier palier', () => {
    const p = stretchProgress(150000, GOALS)
    expect(p.percent).toBe(100)
    expect(p.next).toBeNull()
    expect(p.reachedCount).toBe(3)
  })

  it('sans palier, la barre reste vide', () => {
    const p = stretchProgress(5000, [])
    expect(p.percent).toBe(0)
    expect(p.markers).toEqual([])
    expect(p.next).toBeNull()
  })
})
