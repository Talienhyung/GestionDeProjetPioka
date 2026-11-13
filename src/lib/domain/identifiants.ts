// src/lib/domain/identifiants.ts
/**
 * Identifiants des comptes créés en lot : « Lucie Martin » devient
 * « lucie.m ». Sans accent ni espace, pour se taper sur un téléphone.
 */

/** « Élise-Anne » → « elise-anne » : minuscules, sans accents, seulement a-z 0-9 . _ - */
export function simplifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’\s]+/g, '')
    .replace(/[^a-z0-9._-]/g, '')
}

/**
 * Propose un identifiant libre : prénom, puis prénom.initiale, puis
 * prénom.nom, puis un numéro. `pris` contient les identifiants déjà utilisés
 * (et reçoit celui choisi, pour enchaîner sur une liste).
 */
export function proposerIdentifiant(nomAffiche: string, pris: Set<string>): string {
  const mots = nomAffiche.trim().split(/\s+/).map(simplifier).filter(Boolean)
  const prenom = (mots[0] ?? 'jeune').slice(0, 20).padEnd(3, 'x')
  const nom = mots.slice(1).join('')
  const candidats = [prenom]
  if (nom) candidats.push(`${prenom}.${nom[0]}`, `${prenom}.${nom.slice(0, 20)}`)
  let choisi = candidats.find((c) => !pris.has(c))
  for (let n = 2; !choisi; n += 1) {
    const c = `${candidats[candidats.length - 1]}${n}`
    if (!pris.has(c)) choisi = c
  }
  pris.add(choisi)
  return choisi
}

/** Une ligne par jeune ; lignes vides et doublons écartés, espaces resserrés. */
export function lireListeDeNoms(texte: string): string[] {
  const vus = new Set<string>()
  const noms: string[] = []
  for (const ligne of texte.split(/\r?\n/)) {
    const nom = ligne.replace(/\s+/g, ' ').trim()
    const cle = nom.toLowerCase()
    if (!nom || vus.has(cle)) continue
    vus.add(cle)
    noms.push(nom)
  }
  return noms
}
