// src/lib/domain/parcours.ts
import { dayKey } from './agenda'

/**
 * Le parcours d'un jeune : sa route, étape par étape. Tout ce qu'il a vécu
 * dans la caravane, dans l'ordre : activités de l'agenda, tâches validées,
 * rôles tenus, badges, petits boulots, bonus. Chaque étape porte les points
 * qu'elle a rapportés, et le total cumulé depuis le départ.
 *
 * Fonctions pures : le service rassemble les données, ceci les met en ordre.
 */

export type GenreEtape = 'DEPART' | 'ACTIVITE' | 'TACHE' | 'ROLE' | 'BADGE' | 'BOULOT' | 'BONUS' | 'A_VENIR'

export interface Etape {
  /** Unique dans le parcours. */
  cle: string
  genre: GenreEtape
  date: Date
  titre: string
  /** CAP, lieu, description courte… */
  detail: string | null
  /** Points gagnés à cette étape (0 si aucun). */
  points: number
  /** Points cumulés jusqu'à cette étape incluse. */
  cumul: number
  /** Page liée, s'il y en a une. */
  lien: string | null
  /** Pour une étape BADGE : de quoi dessiner l'écusson. */
  badgeId?: string
}

export interface LignePoints {
  amount: number
  reason: string
  createdAt: Date
  taskId: string | null
  projectRoleId: string | null
  badgeId: string | null
  /** Points donnés à la main : la raison du chef. */
  note?: string | null
}

export interface DonneesParcours {
  arrivee: Date
  activites: { id: string; title: string; location: string; description?: string; startsAt: Date; endsAt: Date | null }[]
  aVenir: { id: string; title: string; location: string; description?: string; startsAt: Date } | null
  taches: { id: string; projectId: string; title: string; projectTitle: string; validatedAt: Date }[]
  roles: { id: string; name: string; projectTitle: string; closedAt: Date }[]
  badges: { id: string; name: string; description: string; earnedAt: Date; reason?: string | null }[]
  boulots: { id: string; title: string; doneOn: Date }[]
  points: LignePoints[]
}

/** Points rattachés à une tâche, un rôle ou un badge ; le reste devient des étapes « bonus ». */
function regrouperPoints(points: LignePoints[]) {
  const parTache = new Map<string, number>()
  const parRole = new Map<string, number>()
  const parBadge = new Map<string, number>()
  const libres: LignePoints[] = []

  const ajouter = (m: Map<string, number>, cle: string, n: number) => m.set(cle, (m.get(cle) ?? 0) + n)

  for (const p of points) {
    // Une validation annulée retire ses points de la tâche elle-même.
    if ((p.reason === 'TACHE' || p.reason === 'ANNULATION') && p.taskId) ajouter(parTache, p.taskId, p.amount)
    else if (p.reason === 'ROLE' && p.projectRoleId) ajouter(parRole, p.projectRoleId, p.amount)
    else if (p.reason === 'BADGE' && p.badgeId) ajouter(parBadge, p.badgeId, p.amount)
    else libres.push(p)
  }
  return { parTache, parRole, parBadge, libres }
}

/** Lieu puis description, sur deux lignes, en sautant ce qui est vide. */
const lignes = (...parts: (string | undefined)[]) => parts.filter((p) => p?.trim()).join('\n') || null

const ORDRE_GENRE: Record<GenreEtape, number> = {
  DEPART: 0,
  ACTIVITE: 1,
  BOULOT: 2,
  TACHE: 3,
  ROLE: 4,
  BONUS: 5,
  BADGE: 6,
  A_VENIR: 7,
}

export function construireParcours(d: DonneesParcours, maintenant = new Date()): Etape[] {
  const { parTache, parRole, parBadge, libres } = regrouperPoints(d.points)
  const etapes: Omit<Etape, 'cumul'>[] = []

  for (const a of d.activites) {
    const fin = a.endsAt ?? a.startsAt
    if (fin.getTime() > maintenant.getTime()) continue
    etapes.push({
      cle: `activite-${a.id}`,
      genre: 'ACTIVITE',
      date: a.startsAt,
      titre: a.title,
      detail: lignes(a.location, a.description),
      points: 0,
      // L'agenda des jeunes vit sur l'accueil : on y ouvre le bon jour.
      lien: `/accueil?mois=${dayKey(a.startsAt).slice(0, 7)}&jour=${dayKey(a.startsAt)}`,
    })
  }

  for (const t of d.taches) {
    etapes.push({
      cle: `tache-${t.id}`,
      genre: 'TACHE',
      date: t.validatedAt,
      titre: t.title,
      detail: t.projectTitle,
      points: parTache.get(t.id) ?? 0,
      lien: `/cap/${t.projectId}/tache/${t.id}`,
    })
  }

  for (const r of d.roles) {
    etapes.push({
      cle: `role-${r.id}`,
      genre: 'ROLE',
      date: r.closedAt,
      titre: r.name,
      detail: r.projectTitle,
      points: parRole.get(r.id) ?? 0,
      lien: null,
    })
  }

  for (const b of d.badges) {
    etapes.push({
      cle: `badge-${b.id}`,
      genre: 'BADGE',
      date: b.earnedAt,
      titre: b.name,
      detail: b.reason ? `« ${b.reason} »` : b.description || null,
      points: parBadge.get(b.id) ?? 0,
      lien: '/profil',
      badgeId: b.id,
    })
  }

  for (const j of d.boulots) {
    etapes.push({
      cle: `boulot-${j.id}`,
      genre: 'BOULOT',
      date: j.doneOn,
      titre: j.title,
      detail: 'Pour les récoltes de la caravane',
      points: 0,
      lien: null,
    })
  }

  libres.forEach((p, i) => {
    if (p.amount === 0) return
    etapes.push({
      cle: `bonus-${i}-${p.createdAt.getTime()}`,
      genre: 'BONUS',
      date: p.createdAt,
      titre: p.amount > 0 ? 'Points en bonus' : 'Points retirés',
      detail: p.note ? `« ${p.note} »` : null,
      points: p.amount,
      lien: null,
    })
  })

  etapes.sort((a, b) => a.date.getTime() - b.date.getTime() || ORDRE_GENRE[a.genre] - ORDRE_GENRE[b.genre])

  // Le départ ouvre toujours la route, même si une étape est datée d'avant
  // l'inscription (une activité saisie après coup, par exemple).
  const premiere = etapes[0]?.date
  const depart = premiere && premiere.getTime() < d.arrivee.getTime() ? premiere : d.arrivee
  etapes.unshift({
    cle: 'depart',
    genre: 'DEPART',
    date: depart,
    titre: 'Le départ',
    detail: 'Ton arrivée dans la caravane',
    points: 0,
    lien: null,
  })

  let cumul = 0
  const parcours: Etape[] = etapes.map((e) => {
    cumul += e.points
    return { ...e, cumul }
  })

  if (d.aVenir && d.aVenir.startsAt.getTime() > maintenant.getTime()) {
    parcours.push({
      cle: `a-venir-${d.aVenir.id}`,
      genre: 'A_VENIR',
      date: d.aVenir.startsAt,
      titre: d.aVenir.title,
      detail: lignes(d.aVenir.location, d.aVenir.description),
      points: 0,
      cumul,
      lien: '/accueil',
    })
  }

  return parcours
}

/** Où ouvrir le parcours : sur la dernière étape vécue, pas sur le prochain rendez-vous. */
export function etapeDeDepart(parcours: Etape[]): number {
  for (let i = parcours.length - 1; i >= 0; i--) if (parcours[i].genre !== 'A_VENIR') return i
  return 0
}

export interface Bilan {
  points: number
  badges: number
  activites: number
  taches: number
}

export function bilanParcours(parcours: Etape[]): Bilan {
  return {
    points: parcours.at(-1)?.cumul ?? 0,
    badges: parcours.filter((e) => e.genre === 'BADGE').length,
    activites: parcours.filter((e) => e.genre === 'ACTIVITE').length,
    taches: parcours.filter((e) => e.genre === 'TACHE').length,
  }
}
