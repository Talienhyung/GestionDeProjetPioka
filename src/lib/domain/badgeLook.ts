// src/lib/domain/badgeLook.ts
/** Apparence d'un écusson : niveau, couleur, lisibilité. Règles pures. */

export const NIVEAU_MIN = 1
export const NIVEAU_MAX = 5
export const NIVEAUX = [1, 2, 3, 4, 5] as const

const ROMAINS = ['I', 'II', 'III', 'IV', 'V']

export function niveauRomain(niveau: number): string {
  return ROMAINS[clampNiveau(niveau) - 1]
}

export function clampNiveau(niveau: number): number {
  if (!Number.isFinite(niveau)) return NIVEAU_MIN
  return Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, Math.round(niveau)))
}

/** Nom de chaque niveau, pour l'admin. */
export const NOMS_NIVEAUX: Record<number, string> = {
  1: 'Cousu main',
  2: 'Bronze',
  3: 'Argent',
  4: 'Or',
  5: 'Légendaire',
}

/** Couleurs de la charte SGDF, proposées en premier dans le sélecteur. */
export const COULEURS_CHARTE = ['#d03f15', '#003a5d', '#007254', '#ff8300', '#6e74aa', '#65bc99'] as const

export const COULEUR_DEFAUT = '#d03f15'

const HEX = /^#[0-9a-f]{6}$/

/** « #ABC », « abcdef », « #AbCdEf » → « #aabbcc » ; null si ce n'est pas une couleur. */
export function normaliserCouleur(saisie: string | null | undefined): string | null {
  if (!saisie) return null
  let v = saisie.trim().toLowerCase()
  if (!v.startsWith('#')) v = `#${v}`
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return HEX.test(v) ? v : null
}

/** Luminance relative (WCAG) d'une couleur #rrggbb. */
function luminance(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

function contraste(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const ENCRE = '#003a5d'
const BLANC = '#ffffff'

/** Couleur du picto sur ce fond : blanc ou encre de la charte, la plus lisible. */
export function couleurSurFond(fond: string): string {
  const hex = normaliserCouleur(fond) ?? COULEUR_DEFAUT
  const l = luminance(hex)
  return contraste(l, luminance(BLANC)) >= contraste(l, luminance(ENCRE)) ? BLANC : ENCRE
}

/** Garde les couleurs récentes : la dernière en tête, sans doublon, 12 au plus. */
export function ajouterCouleurRecente(recentes: string[], couleur: string, max = 12): string[] {
  const c = normaliserCouleur(couleur)
  if (!c) return recentes
  return [c, ...recentes.filter((r) => r !== c)].slice(0, max)
}

/** Code stable d'un badge à partir de son nom : « Esprit d'équipe » → « esprit_d_equipe ». */
export function codeDepuisNom(nom: string): string {
  const code = nom
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return code || 'badge'
}
