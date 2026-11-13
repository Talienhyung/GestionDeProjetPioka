// src/lib/services/exportService.ts
import { allModels } from '@/lib/data/schema'
import type { Db } from '@/lib/db'
import { CHAMPS_EXCLUS, TABLES_EXCLUES, type TableExport, versCsv } from '@/lib/domain/exportCsv'
import type { Actor } from '@/lib/domain/types'
import { ForbiddenError } from './errors'

type Delegue = { findMany: (args: object) => Promise<Record<string, unknown>[]>; count: () => Promise<number> }

export function delegue(db: Db, nom: string): Delegue {
  return (db as unknown as Record<string, Delegue>)[nom]
}

/** Toutes les tables du schéma, secrets retirés, en un CSV. Réservé au super admin. */
export async function exportAllCsv(db: Db, actor: Actor): Promise<{ csv: string; tables: TableExport[] }> {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError()

  const tables: TableExport[] = []
  for (const meta of allModels()) {
    if (TABLES_EXCLUES.has(meta.name)) continue
    const exclus = CHAMPS_EXCLUS[meta.name] ?? new Set<string>()
    const colonnes = meta.scalars.map((f) => f.name).filter((c) => !exclus.has(c))
    const lignes = await delegue(db, meta.delegate).findMany({ orderBy: { [meta.idField]: 'asc' } })
    tables.push({ nom: meta.name, colonnes, lignes })
  }
  return { csv: versCsv(tables), tables }
}
