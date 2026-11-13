// src/lib/data/backend.ts
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Prisma } from '@prisma/client'
import { type Rec, allModels, cloneRec, model, revive, serialize, uniqueKeys } from './schema'

/** Un enregistrement tel que stocké, avec son numéro de version. */
export interface Stored {
  data: Rec
  version: number
}

/**
 * Une écriture à valider. `expect` est la version lue avant modification
 * (null : l'enregistrement ne doit pas exister) ; la validation échoue si
 * quelqu'un a écrit entre-temps (verrou optimiste).
 */
export interface WriteOp {
  model: string
  id: string
  expect: number | null
  /** null : suppression. */
  data: Rec | null
  uniquesAdd: string[]
  uniquesRemove: string[]
}

export interface Backend {
  load(model: string): Promise<Map<string, Stored>>
  /** Valide toutes les écritures ensemble, ou aucune. */
  commit(ops: WriteOp[]): Promise<void>
}

export const clientVersion = Prisma.prismaVersion?.client ?? 'dynamo'

export function uniqueViolation(key: string): Error {
  const fields = key.split('#')[1]?.split('=')[0]?.split('+') ?? []
  return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on the fields: (${fields.join(', ')})`, {
    code: 'P2002',
    clientVersion,
    meta: { target: fields },
  })
}

export function writeConflict(): Error {
  return new Prisma.PrismaClientKnownRequestError(
    'Transaction failed due to a write conflict. Please retry your transaction',
    { code: 'P2034', clientVersion },
  )
}

/**
 * Remplace `cible` par `source` d'un bloc. Sous Windows, le renommage échoue
 * (EPERM, EBUSY) tant qu'un autre processus lit le fichier, le serveur de dev
 * pendant un amorçage par exemple : on réessaie quelques instants.
 */
function remplacer(source: string, cible: string): void {
  for (let essai = 0; ; essai++) {
    try {
      renameSync(source, cible)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (essai >= 40 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
    }
  }
}

/** Tout en mémoire : les tests, et la base du magasin fichier. */
export class MemoryBackend implements Backend {
  protected tables = new Map<string, Map<string, Stored>>()
  protected uniques = new Map<string, string>()

  async load(name: string): Promise<Map<string, Stored>> {
    const table = this.tables.get(name) ?? new Map<string, Stored>()
    const copy = new Map<string, Stored>()
    for (const [id, s] of table) copy.set(id, { data: cloneRec(s.data), version: s.version })
    return copy
  }

  async commit(ops: WriteOp[]): Promise<void> {
    this.apply(ops)
  }

  protected apply(ops: WriteOp[]): void {
    // Tout vérifier d'abord : rien n'est écrit si une seule écriture échoue.
    const removed = new Set(ops.flatMap((op) => op.uniquesRemove))
    const added = new Set<string>()
    for (const op of ops) {
      const current = this.tables.get(op.model)?.get(op.id)
      if ((current?.version ?? null) !== op.expect) throw writeConflict()
      for (const key of op.uniquesAdd) {
        if ((this.uniques.has(key) && !removed.has(key)) || added.has(key)) throw uniqueViolation(key)
        added.add(key)
      }
    }
    for (const op of ops) {
      for (const key of op.uniquesRemove) this.uniques.delete(key)
    }
    for (const op of ops) {
      let table = this.tables.get(op.model)
      if (!table) this.tables.set(op.model, (table = new Map()))
      if (op.data === null) table.delete(op.id)
      else table.set(op.id, { data: cloneRec(op.data), version: (op.expect ?? 0) + 1 })
      for (const key of op.uniquesAdd) this.uniques.set(key, op.id)
    }
  }
}

/**
 * Un fichier JSON sur le disque : le poste de développement et l'hébergement
 * Docker sur un seul serveur. Relu si un autre processus l'a modifié
 * (l'amorçage lancé à côté du serveur de dev, par exemple).
 */
export class FileBackend extends MemoryBackend {
  private mtime = -1

  constructor(private readonly file: string) {
    super()
  }

  private refresh(): void {
    if (!existsSync(this.file)) {
      if (this.mtime !== -1) {
        this.tables.clear()
        this.uniques.clear()
        this.mtime = -1
      }
      return
    }
    const mtime = statSync(this.file).mtimeMs
    if (mtime === this.mtime) return
    const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, { id: string; v: number; d: Rec }[]>
    this.tables.clear()
    this.uniques.clear()
    for (const [name, rows] of Object.entries(raw)) {
      const meta = model(name)
      const table = new Map<string, Stored>()
      for (const row of rows) {
        const data = revive(meta, row.d)
        table.set(row.id, { data, version: row.v })
        for (const key of uniqueKeys(meta, data)) this.uniques.set(key, row.id)
      }
      this.tables.set(name, table)
    }
    this.mtime = mtime
  }

  async load(name: string): Promise<Map<string, Stored>> {
    this.refresh()
    return super.load(name)
  }

  async commit(ops: WriteOp[]): Promise<void> {
    this.refresh()
    this.apply(ops)
    const out: Record<string, { id: string; v: number; d: Rec }[]> = {}
    for (const meta of allModels()) {
      const table = this.tables.get(meta.name)
      if (!table || table.size === 0) continue
      out[meta.name] = [...table].map(([id, s]) => ({ id, v: s.version, d: serialize(meta, s.data) }))
    }
    mkdirSync(dirname(this.file), { recursive: true })
    // Écriture puis renommage : un arrêt brutal ne laisse jamais un fichier à moitié écrit.
    const tmp = `${this.file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(out))
    remplacer(tmp, this.file)
    this.mtime = statSync(this.file).mtimeMs
  }
}
