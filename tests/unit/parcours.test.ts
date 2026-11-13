import { describe, expect, it } from 'vitest'
import { type DonneesParcours, bilanParcours, construireParcours, etapeDeDepart } from '@/lib/domain/parcours'

const jour = (j: number) => new Date(Date.UTC(2026, 8, j, 10))
const MAINTENANT = jour(30)

function donnees(over: Partial<DonneesParcours> = {}): DonneesParcours {
  return {
    arrivee: jour(1),
    activites: [],
    aVenir: null,
    taches: [],
    roles: [],
    badges: [],
    boulots: [],
    points: [],
    ...over,
  }
}

const ligne = (amount: number, reason: string, ids: Partial<{ taskId: string; projectRoleId: string; badgeId: string }> = {}, j = 10) => ({
  amount,
  reason,
  createdAt: jour(j),
  taskId: ids.taskId ?? null,
  projectRoleId: ids.projectRoleId ?? null,
  badgeId: ids.badgeId ?? null,
})

describe('parcours d’un jeune', () => {
  it('commence toujours par le départ, même vide', () => {
    const p = construireParcours(donnees(), MAINTENANT)
    expect(p.map((e) => e.genre)).toEqual(['DEPART'])
    expect(etapeDeDepart(p)).toBe(0)
  })

  it('met les étapes dans l’ordre et cumule les points rattachés', () => {
    const p = construireParcours(
      donnees({
        activites: [{ id: 'a1', title: 'Week-end vélo', location: 'Annecy', startsAt: jour(5), endsAt: jour(6) }],
        taches: [{ id: 't1', projectId: 'p1', title: 'Budget', projectTitle: 'Camp', validatedAt: jour(8) }],
        badges: [{ id: 'b1', name: 'Premier pas', description: '', earnedAt: jour(8) }],
        roles: [{ id: 'r1', name: 'Trésorier', projectTitle: 'Camp', closedAt: jour(20) }],
        points: [
          ligne(10, 'TACHE', { taskId: 't1' }, 8),
          ligne(5, 'BADGE', { badgeId: 'b1' }, 8),
          ligne(15, 'ROLE', { projectRoleId: 'r1' }, 20),
          ligne(3, 'BONUS', {}, 12),
        ],
      }),
      MAINTENANT,
    )

    expect(p.map((e) => e.genre)).toEqual(['DEPART', 'ACTIVITE', 'TACHE', 'BADGE', 'BONUS', 'ROLE'])
    expect(p.map((e) => e.points)).toEqual([0, 0, 10, 5, 3, 15])
    expect(p.map((e) => e.cumul)).toEqual([0, 0, 10, 15, 18, 33])
    expect(p[2].lien).toBe('/cap/p1/tache/t1')
    expect(bilanParcours(p)).toEqual({ points: 33, badges: 1, activites: 1, taches: 1 })
  })

  it('retire les points d’une validation annulée de la tâche elle-même', () => {
    const p = construireParcours(
      donnees({
        taches: [{ id: 't1', projectId: 'p1', title: 'Budget', projectTitle: 'Camp', validatedAt: jour(8) }],
        points: [ligne(10, 'TACHE', { taskId: 't1' }), ligne(-10, 'ANNULATION', { taskId: 't1' })],
      }),
      MAINTENANT,
    )
    expect(p.find((e) => e.genre === 'TACHE')?.points).toBe(0)
    expect(p.some((e) => e.genre === 'BONUS')).toBe(false)
  })

  it('n’affiche que les activités terminées, et le prochain rendez-vous à la fin', () => {
    const p = construireParcours(
      donnees({
        activites: [
          { id: 'passee', title: 'Rando', location: '', startsAt: jour(10), endsAt: null },
          { id: 'en-cours', title: 'Camp', location: '', startsAt: jour(29), endsAt: jour(31) },
        ],
        aVenir: { id: 'v', title: 'Réunion', location: 'Local', startsAt: jour(35) },
      }),
      MAINTENANT,
    )
    expect(p.map((e) => e.cle)).toEqual(['depart', 'activite-passee', 'a-venir-v'])
    // On ouvre sur la dernière étape vécue, pas sur ce qui vient.
    expect(etapeDeDepart(p)).toBe(1)
  })

  it('fait commencer le départ avant une étape antérieure à l’inscription', () => {
    const p = construireParcours(
      donnees({
        arrivee: jour(10),
        activites: [{ id: 'a', title: 'Sortie', location: '', startsAt: jour(3), endsAt: null }],
      }),
      MAINTENANT,
    )
    expect(p[0].genre).toBe('DEPART')
    expect(p[0].date).toEqual(jour(3))
  })
})
