import { describe, expect, it } from 'vitest'
import { lireListeDeNoms, proposerIdentifiant, simplifier } from '@/lib/domain/identifiants'

describe('identifiants', () => {
  it('simplifie accents, espaces et apostrophes', () => {
    expect(simplifier("Élise-Anne D'Arc")).toBe('elise-annedarc')
  })

  it('propose prénom, puis prénom.initiale, puis prénom.nom, puis un numéro', () => {
    const pris = new Set(['admin'])
    expect(proposerIdentifiant('Lucie Martin', pris)).toBe('lucie')
    expect(proposerIdentifiant('Lucie Moreau', pris)).toBe('lucie.m')
    expect(proposerIdentifiant('Lucie Mercier', pris)).toBe('lucie.mercier')
    expect(proposerIdentifiant('Lucie Mercier', pris)).toBe('lucie.mercier2')
    expect(proposerIdentifiant('Zoé', pris)).toBe('zoe')
    expect(proposerIdentifiant('Zoé', pris)).toBe('zoe2')
  })

  it('complète un prénom trop court pour faire un identifiant valide', () => {
    expect(proposerIdentifiant('Al', new Set())).toBe('alx')
  })

  it('lit une liste : lignes vides et doublons écartés', () => {
    expect(lireListeDeNoms('  Lucie  Martin \r\n\nTom\nlucie martin\n')).toEqual(['Lucie Martin', 'Tom'])
  })
})
