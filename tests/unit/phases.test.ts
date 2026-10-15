// tests/unit/phases.test.ts
import { describe, expect, it } from 'vitest'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

describe('phaseProgress', () => {
  it('compte les tâches terminées', () => {
    expect(phaseProgress([{ status: 'TERMINEE' }, { status: 'OUVERTE' }, { status: 'SOUMISE' }]))
      .toEqual({ done: 1, total: 3, percent: 33 })
  })

  it('rend 0 % sans tâche, sans diviser par zéro', () => {
    expect(phaseProgress([])).toEqual({ done: 0, total: 0, percent: 0 })
  })

  it('rend 100 % quand tout est terminé', () => {
    expect(phaseProgress([{ status: 'TERMINEE' }, { status: 'TERMINEE' }]).percent).toBe(100)
  })
})

describe('PHASE_STYLES', () => {
  it('couvre les trois phases avec un libellé français', () => {
    expect(Object.keys(PHASE_STYLES)).toEqual(['CHOISIR', 'AGIR', 'PARTAGER'])
    expect(PHASE_STYLES.PARTAGER.label).toBe('Partager')
  })
})
