import { describe, expect, it } from 'vitest'
import { PHASES, type Phase } from '@/lib/domain/types'
import { DIFFICULTY_MARKS, PHASE_STYLES, difficultyMarks, phaseProgress } from '@/lib/ui/phases'

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

  it('donne à chaque phase ses quatre classes de balisage', () => {
    for (const phase of PHASES) {
      const style = PHASE_STYLES[phase as Phase]
      expect(style.rail).toMatch(/^bg-/)
      expect(style.ink).toMatch(/^text-/)
      expect(style.soft).toMatch(/^bg-/)
      expect(style.border).toMatch(/^border-/)
    }
  })

  it('n’utilise que des jetons du thème, jamais une couleur brute de Tailwind', () => {
    const classes = Object.values(PHASE_STYLES).flatMap((style) => [
      style.rail, style.ink, style.soft, style.border,
    ])
    // bg-amber-100, text-red-900… : ce sont ces classes-là qui cassaient le thème sombre.
    expect(classes.filter((classe) => /-\d{2,3}$/.test(classe))).toEqual([])
  })
})

describe('difficultyMarks', () => {
  it('rend des marques de sentier, une par niveau', () => {
    expect(difficultyMarks('FACILE')).toBe('●○○')
    expect(difficultyMarks('MOYEN')).toBe('●●○')
    expect(difficultyMarks('DIFFICILE')).toBe('●●●')
  })

  it('expose la table complète', () => {
    expect(Object.keys(DIFFICULTY_MARKS)).toEqual(['FACILE', 'MOYEN', 'DIFFICILE'])
  })
})
