// src/lib/services/badgeAdminService.ts
/**
 * Le catalogue des badges, géré par le super admin : créer, modifier,
 * supprimer, et l'apparence de chaque écusson (picto ou image, couleur,
 * niveau). Les fichiers ne passent pas par ici : l'action enregistre
 * l'image, ce service range son nom et rend l'ancien pour qu'on l'efface.
 */
import { estPictoConnu } from '@/components/sgdf/catalogue'
import type { Db } from '@/lib/db'
import { BADGE_RULE_TYPES, type BadgeRuleType } from '@/lib/domain/badges'
import { ajouterCouleurRecente, clampNiveau, codeDepuisNom, normaliserCouleur } from '@/lib/domain/badgeLook'
import type { Actor } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

const RECENT_COLORS_KEY = 'badgeRecentColors'

export interface BadgeInput {
  name: string
  description: string
  ruleType: string
  threshold: number
  points: number
  sortOrder: number
  level: number
  color: string
  /** Clé du catalogue de pictos, ou null pour garder l'image. */
  pictoKey: string | null
  /** Nouvelle image enregistrée, à poser sur le badge. */
  imageName?: string | null
  /** Retirer l'image actuelle (le picto reprend la main). */
  removeImage?: boolean
}

function assertSuperAdmin(actor: Actor) {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError()
}

function entier(v: number, min: number, max: number, champ: string): number {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new ValidationError(`${champ} : un nombre entier entre ${min} et ${max}.`)
  }
  return v
}

function valider(input: BadgeInput) {
  const name = input.name.trim()
  if (!name) throw new ValidationError('Le badge a besoin d’un nom.')
  if (name.length > 40) throw new ValidationError('Le nom tient en 40 caractères.')
  const description = input.description.trim()
  if (description.length > 200) throw new ValidationError('La description tient en 200 caractères.')
  if (!BADGE_RULE_TYPES.includes(input.ruleType as BadgeRuleType)) throw new ValidationError('Condition inconnue.')
  const color = normaliserCouleur(input.color)
  if (!color) throw new ValidationError('Couleur invalide : choisis-la au format #rrggbb.')
  if (input.pictoKey !== null && !estPictoConnu(input.pictoKey)) throw new ValidationError('Pictogramme inconnu.')

  return {
    name,
    description,
    ruleType: input.ruleType,
    threshold: entier(input.threshold, 1, 1000, 'Seuil'),
    points: entier(input.points, 0, 1000, 'Points'),
    sortOrder: entier(input.sortOrder, 0, 10000, 'Ordre'),
    level: clampNiveau(input.level),
    color,
    pictoKey: input.pictoKey,
  }
}

async function codeLibre(db: Db, name: string, exceptId?: string): Promise<string> {
  const base = codeDepuisNom(name)
  const pris = new Set(
    (await db.badge.findMany({ select: { id: true, code: true } })).filter((b) => b.id !== exceptId).map((b) => b.code),
  )
  if (!pris.has(base)) return base
  let i = 2
  while (pris.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

async function retenirCouleur(db: Db, color: string) {
  const value = JSON.stringify(ajouterCouleurRecente(await getRecentColors(db), color))
  await db.setting.upsert({ where: { key: RECENT_COLORS_KEY }, update: { value }, create: { key: RECENT_COLORS_KEY, value } })
}

export async function getRecentColors(db: Db): Promise<string[]> {
  const setting = await db.setting.findUnique({ where: { key: RECENT_COLORS_KEY } })
  try {
    const parsed: unknown = JSON.parse(setting?.value ?? '[]')
    return Array.isArray(parsed) ? parsed.map((c) => normaliserCouleur(String(c))).filter((c): c is string => !!c) : []
  } catch {
    return []
  }
}

export async function listBadgesAdmin(db: Db) {
  return db.badge.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { userBadges: true } } },
  })
}

export async function createBadge(db: Db, actor: Actor, input: BadgeInput) {
  assertSuperAdmin(actor)
  const data = valider(input)
  const imageName = input.imageName ?? null
  if (!data.pictoKey && !imageName) throw new ValidationError('Choisis un pictogramme ou envoie une image.')

  const badge = await db.badge.create({
    data: { ...data, imageName, icon: '', code: await codeLibre(db, data.name) },
  })
  await retenirCouleur(db, data.color)
  return badge
}

/** Modifie un badge. Rend le nom de l'image remplacée ou retirée, à effacer du stockage. */
export async function updateBadge(db: Db, actor: Actor, badgeId: string, input: BadgeInput) {
  assertSuperAdmin(actor)
  const actuel = await db.badge.findUnique({ where: { id: badgeId } })
  if (!actuel) throw new NotFoundError('Badge')
  const data = valider(input)

  const imageName = input.imageName ?? (input.removeImage ? null : actuel.imageName)
  if (!data.pictoKey && !imageName) throw new ValidationError('Choisis un pictogramme ou envoie une image.')

  const badge = await db.badge.update({ where: { id: badgeId }, data: { ...data, imageName } })
  await retenirCouleur(db, data.color)
  const obsolete = actuel.imageName && actuel.imageName !== imageName ? actuel.imageName : null
  return { badge, obsoleteImage: obsolete }
}

/**
 * Supprime un badge et le retire des profils. Les points déjà gagnés grâce à
 * lui restent acquis : ils sont dans le relevé de chacun.
 */
export async function deleteBadge(db: Db, actor: Actor, badgeId: string) {
  assertSuperAdmin(actor)
  const badge = await db.badge.findUnique({ where: { id: badgeId } })
  if (!badge) throw new NotFoundError('Badge')
  await db.badge.delete({ where: { id: badgeId } })
  return { obsoleteImage: badge.imageName }
}
