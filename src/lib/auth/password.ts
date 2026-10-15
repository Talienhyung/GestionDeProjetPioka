import { randomInt } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'

export const MIN_PASSWORD_LENGTH = 8

export class WeakPasswordError extends Error {
  constructor() {
    super(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`)
    this.name = 'WeakPasswordError'
  }
}

export function assertPasswordAcceptable(plain: string): void {
  if (plain.trim().length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError()
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { algorithm: 2 /* argon2id */ })
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain)
  } catch {
    return false
  }
}

/** Alphabet sans caractères ambigus : un chef dicte ce mot de passe à l'oral. */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export function generateTempPassword(): string {
  let out = ''
  for (let i = 0; i < 12; i += 1) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}
