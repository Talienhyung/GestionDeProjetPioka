// tests/unit/badges.test.ts
import { describe, expect, it } from 'vitest'
import { type BadgeRule, type UserStats, emptyStats, evaluateBadges, measure } from '@/lib/domain/badges'

const RULES: BadgeRule[] = [
  { code: 'premier_pas', ruleType: 'TACHES_VALIDEES', threshold: 1 },
  { code: 'bosseur_1', ruleType: 'TACHES_VALIDEES', threshold: 5 },
  { code: 'costaud', ruleType: 'TACHE_DIFFICILE', threshold: 1 },
  { code: 'equipe', ruleType: 'TACHES_EN_EQUIPE', threshold: 5 },
  { code: 'debut_fin', ruleType: 'TOUTES_PHASES', threshold: 3 },
  { code: 'sans_faute', ruleType: 'SERIE_SANS_REFUS', threshold: 3 },
  { code: 'responsable', ruleType: 'ROLE_CLOTURE', threshold: 1 },
  { code: 'photographe', ruleType: 'SOUMISSIONS_AVEC_PHOTO', threshold: 5 },
]

const stats = (over: Partial<UserStats> = {}): UserStats => ({ ...emptyStats(), ...over })

describe('evaluateBadges', () => {
  it('ne donne rien à un jeune qui démarre', () => {
    expect(evaluateBadges(RULES, emptyStats(), [])).toEqual([])
  })

  it('donne le premier pas dès la première tâche validée', () => {
    expect(evaluateBadges(RULES, stats({ validatedTaskCount: 1 }), [])).toEqual(['premier_pas'])
  })

  it('donne les deux paliers d un coup si le seuil supérieur est franchi', () => {
    expect(evaluateBadges(RULES, stats({ validatedTaskCount: 6 }), [])).toEqual(['premier_pas', 'bosseur_1'])
  })

  it('ignore les badges déjà obtenus', () => {
    expect(evaluateBadges(RULES, stats({ validatedTaskCount: 6 }), ['premier_pas'])).toEqual(['bosseur_1'])
  })

  it('donne du début à la fin uniquement si les 3 phases sont couvertes sur un MÊME projet', () => {
    const deuxProjets = stats({
      validatedTaskCount: 3,
      phasesByProject: { p1: ['CHOISIR', 'AGIR'], p2: ['PARTAGER'] },
    })
    expect(evaluateBadges(RULES, deuxProjets, ['premier_pas'])).toEqual([])

    const unSeul = stats({
      validatedTaskCount: 3,
      phasesByProject: { p1: ['CHOISIR', 'AGIR', 'PARTAGER'] },
    })
    expect(evaluateBadges(RULES, unSeul, ['premier_pas'])).toEqual(['debut_fin'])
  })

  it('ne compte pas deux fois la même phase', () => {
    const s = stats({ phasesByProject: { p1: ['AGIR', 'AGIR', 'AGIR'] } })
    expect(measure('TOUTES_PHASES', s)).toBe(1)
  })

  it('donne costaud, esprit d équipe, sans faute, responsable et photographe au bon seuil', () => {
    const s = stats({
      validatedTaskCount: 5,
      hardValidatedTaskCount: 1,
      teamValidatedTaskCount: 5,
      cleanStreak: 3,
      closedRoleCount: 1,
      photoSubmissionCount: 5,
    })
    expect(evaluateBadges(RULES, s, [])).toEqual([
      'premier_pas', 'bosseur_1', 'costaud', 'equipe', 'sans_faute', 'responsable', 'photographe',
    ])
  })

  it('ignore une règle de type inconnu plutôt que de planter', () => {
    const rules = [{ code: 'mystere', ruleType: 'INEXISTANT' as never, threshold: 1 }]
    expect(evaluateBadges(rules, stats({ validatedTaskCount: 99 }), [])).toEqual([])
  })
})
