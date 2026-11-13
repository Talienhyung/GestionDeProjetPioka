import { describe, expect, it } from 'vitest'
import { CATALOGUE_PICTOS, estPictoConnu } from '@/components/sgdf/catalogue'
import {
  ajouterCouleurRecente,
  clampNiveau,
  codeDepuisNom,
  couleurSurFond,
  niveauRomain,
  normaliserCouleur,
} from '@/lib/domain/badgeLook'
import { existsSync } from 'node:fs'

describe('apparence des écussons', () => {
  it('écrit les niveaux en chiffres romains, bornés de I à V', () => {
    expect([1, 2, 3, 4, 5].map(niveauRomain)).toEqual(['I', 'II', 'III', 'IV', 'V'])
    expect(clampNiveau(0)).toBe(1)
    expect(clampNiveau(9)).toBe(5)
    expect(clampNiveau(Number.NaN)).toBe(1)
  })

  it('normalise les couleurs et refuse le reste', () => {
    expect(normaliserCouleur('#D03F15')).toBe('#d03f15')
    expect(normaliserCouleur('abc')).toBe('#aabbcc')
    expect(normaliserCouleur(' #00ff00 ')).toBe('#00ff00')
    expect(normaliserCouleur('rouge')).toBeNull()
    expect(normaliserCouleur('#12345')).toBeNull()
  })

  it('choisit le picto le plus lisible sur le fond', () => {
    expect(couleurSurFond('#003a5d')).toBe('#ffffff')
    expect(couleurSurFond('#d03f15')).toBe('#ffffff')
    expect(couleurSurFond('#ffd34d')).toBe('#003a5d')
    expect(couleurSurFond('#ffffff')).toBe('#003a5d')
  })

  it('garde les couleurs récentes, la dernière en tête, sans doublon', () => {
    let recentes: string[] = []
    for (const c of ['#111111', '#222222', '#111111', 'pas une couleur']) recentes = ajouterCouleurRecente(recentes, c)
    expect(recentes).toEqual(['#111111', '#222222'])
    for (let i = 0; i < 20; i++) recentes = ajouterCouleurRecente(recentes, `#0000${String(i).padStart(2, '0')}`)
    expect(recentes).toHaveLength(12)
  })

  it('fabrique un code à partir du nom', () => {
    expect(codeDepuisNom("Esprit d'équipe")).toBe('esprit_d_equipe')
    expect(codeDepuisNom('  Œil de lynx !! ')).toBe('il_de_lynx')
    expect(codeDepuisNom('???')).toBe('badge')
  })

  it('a un fichier SVG pour chaque picto du catalogue', () => {
    expect(CATALOGUE_PICTOS.length).toBeGreaterThan(150)
    const cles = new Set(CATALOGUE_PICTOS.map((p) => p.cle))
    expect(cles.size).toBe(CATALOGUE_PICTOS.length)
    for (const p of CATALOGUE_PICTOS) expect(existsSync(`public/pictos/${p.cle}.svg`), p.cle).toBe(true)
    expect(estPictoConnu('graine')).toBe(true)
    expect(estPictoConnu('../../etc/passwd')).toBe(false)
  })
})
