// tests/unit/password.test.ts
import { describe, expect, it } from 'vitest'
import {
  WeakPasswordError,
  assertPasswordAcceptable,
  generateTempPassword,
  hashPassword,
  verifyPassword,
} from '@/lib/auth/password'

describe('hachage', () => {
  it('produit un hash argon2id vérifiable', async () => {
    const stored = await hashPassword('jeudi-scout-42')
    expect(stored.startsWith('$argon2id$')).toBe(true)
    expect(await verifyPassword(stored, 'jeudi-scout-42')).toBe(true)
  })

  it('rejette un mauvais mot de passe', async () => {
    const stored = await hashPassword('jeudi-scout-42')
    expect(await verifyPassword(stored, 'jeudi-scout-43')).toBe(false)
  })

  it('produit deux hashs différents pour le même mot de passe', async () => {
    expect(await hashPassword('identique')).not.toBe(await hashPassword('identique'))
  })

  it('rend false sans lever si le hash stocké est corrompu', async () => {
    expect(await verifyPassword('pas-un-hash', 'peu importe')).toBe(false)
  })
})

describe('assertPasswordAcceptable', () => {
  it('accepte un mot de passe de 8 caractères ou plus', () => {
    expect(() => assertPasswordAcceptable('12345678')).not.toThrow()
  })

  it('refuse un mot de passe trop court ou vide', () => {
    expect(() => assertPasswordAcceptable('court')).toThrow(WeakPasswordError)
    expect(() => assertPasswordAcceptable('   ')).toThrow(WeakPasswordError)
  })
})

describe('generateTempPassword', () => {
  it('produit un mot de passe lisible, différent à chaque appel', () => {
    const a = generateTempPassword()
    const b = generateTempPassword()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(10)
    expect(a).not.toMatch(/[O0lI1]/)
    expect(() => assertPasswordAcceptable(a)).not.toThrow()
  })
})
