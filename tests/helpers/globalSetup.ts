import { ensureTemplate } from './db'

/** Construit une fois pour toute la session le gabarit de base de test. */
export default function setup() {
  ensureTemplate()
}
