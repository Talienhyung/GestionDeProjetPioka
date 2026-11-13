// src/lib/data/schema.ts
/**
 * Description des modèles, lue dans le schéma Prisma (DMMF). Prisma ne sert
 * plus qu'à décrire le modèle et à générer les types : les données vivent
 * dans DynamoDB (ou dans un fichier en local), via src/lib/data/client.ts.
 */
import { Prisma } from '@prisma/client'

export type Rec = Record<string, unknown>

export interface FieldMeta {
  name: string
  kind: 'scalar' | 'object' | 'enum' | 'unsupported'
  type: string
  isList: boolean
  isRequired: boolean
  isId: boolean
  isUnique: boolean
  isUpdatedAt: boolean
  default?: { name: string; args: unknown[] } | string | number | boolean
  relationName?: string
  relationFromFields?: string[]
  relationToFields?: string[]
  relationOnDelete?: string
}

export interface ModelMeta {
  name: string
  /** Nom du délégué sur le client : « projectRole » pour ProjectRole. */
  delegate: string
  fields: Map<string, FieldMeta>
  scalars: FieldMeta[]
  relations: FieldMeta[]
  idField: string
  /** Contraintes d'unicité, la clé primaire non comprise. */
  uniques: string[][]
}

const models = new Map<string, ModelMeta>()
const byDelegate = new Map<string, ModelMeta>()

for (const m of Prisma.dmmf.datamodel.models) {
  const fields = new Map<string, FieldMeta>()
  for (const f of m.fields) fields.set(f.name, f as unknown as FieldMeta)
  const all = [...fields.values()]
  const id = all.find((f) => f.isId)
  if (!id) throw new Error(`Le modèle ${m.name} n'a pas de clé @id simple.`)
  const uniques = [
    ...all.filter((f) => f.isUnique).map((f) => [f.name]),
    ...(m.uniqueFields as string[][]),
  ]
  const meta: ModelMeta = {
    name: m.name,
    delegate: m.name[0].toLowerCase() + m.name.slice(1),
    fields,
    scalars: all.filter((f) => f.kind !== 'object'),
    relations: all.filter((f) => f.kind === 'object'),
    idField: id.name,
    uniques,
  }
  models.set(m.name, meta)
  byDelegate.set(meta.delegate, meta)
}

export function model(name: string): ModelMeta {
  const m = models.get(name)
  if (!m) throw new Error(`Modèle inconnu : ${name}`)
  return m
}

export function modelByDelegate(delegate: string): ModelMeta | undefined {
  return byDelegate.get(delegate)
}

export function allModels(): ModelMeta[] {
  return [...models.values()]
}

/**
 * Côté « propriétaire » d'une relation : le champ qui porte la clé étrangère.
 * Pour une relation vue depuis l'autre bout (liste de tâches d'un projet),
 * c'est le champ jumeau dans le modèle cible.
 */
export function relationLink(owner: ModelMeta, field: FieldMeta): {
  /** Le modèle de l'enregistrement courant porte la clé. */
  local: boolean
  from: string[]
  to: string[]
  target: ModelMeta
} {
  const target = model(field.type)
  if (field.relationFromFields && field.relationFromFields.length > 0) {
    return { local: true, from: field.relationFromFields, to: field.relationToFields ?? [], target }
  }
  const twin = target.relations.find(
    (f) => f.relationName === field.relationName && f.type === owner.name && (f.relationFromFields?.length ?? 0) > 0,
  )
  if (!twin) throw new Error(`Relation sans clé : ${owner.name}.${field.name}`)
  return { local: false, from: twin.relationFromFields ?? [], to: twin.relationToFields ?? [], target }
}

/** Enregistrement → JSON stockable (dates en ISO). */
export function serialize(meta: ModelMeta, rec: Rec): Rec {
  const out: Rec = {}
  for (const f of meta.scalars) {
    const v = rec[f.name]
    out[f.name] = v instanceof Date ? v.toISOString() : (v ?? null)
  }
  return out
}

/** JSON stocké → enregistrement (dates rétablies). */
export function revive(meta: ModelMeta, raw: Rec): Rec {
  const out: Rec = {}
  for (const f of meta.scalars) {
    const v = raw[f.name]
    out[f.name] = f.type === 'DateTime' && typeof v === 'string' ? new Date(v) : (v ?? null)
  }
  return out
}

export function cloneRec(rec: Rec): Rec {
  const out: Rec = {}
  for (const [k, v] of Object.entries(rec)) out[k] = v instanceof Date ? new Date(v.getTime()) : v
  return out
}

/** Clé d'unicité stable, ou null si une des valeurs est nulle (comme en SQL). */
export function uniqueKey(meta: ModelMeta, fields: string[], rec: Rec): string | null {
  const values = fields.map((f) => rec[f])
  if (values.some((v) => v === null || v === undefined)) return null
  const norm = values.map((v) => (v instanceof Date ? v.toISOString() : v))
  return `${meta.name}#${fields.join('+')}=${JSON.stringify(norm)}`
}

export function uniqueKeys(meta: ModelMeta, rec: Rec): string[] {
  return meta.uniques.map((u) => uniqueKey(meta, u, rec)).filter((k): k is string => k !== null)
}
