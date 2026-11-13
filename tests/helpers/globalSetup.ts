import { ensureTemplate } from './db'

/** Construit une fois pour toute la session la base gabarit des tests. */
export default async function setup() {
  await ensureTemplate()
}
