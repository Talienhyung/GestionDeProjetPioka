// src/lib/data/client.ts
/**
 * Client de données au contrat de Prisma Client, réduit à ce que le site
 * utilise : findUnique/First/Many, create(Many), update(Many), upsert,
 * delete(Many), count, aggregate, groupBy, $transaction ; filtres where
 * (opérateurs scalaires, AND/OR/NOT, relations some/every/none/is/isNot),
 * select/include imbriqués, _count, orderBy (y compris sur une relation),
 * écritures imbriquées (create, createMany, deleteMany, connect) et
 * suppressions en cascade selon le schéma.
 *
 * Les services, les pages et les tests gardent l'API Prisma ; seule la
 * persistance change (DynamoDB sur Amplify, un fichier en local).
 *
 * Fonctionnement : un modèle se lit en entier (une requête DynamoDB), les
 * filtres et tris se font en mémoire. C'est adapté à une caravane (quelques
 * centaines de lignes par modèle) ; ce n'est pas fait pour des millions.
 * Les écritures d'une opération, ou d'une $transaction, sont validées
 * ensemble, avec un verrou optimiste par enregistrement et des réservations
 * pour les valeurs uniques.
 */
import { randomBytes } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { type Backend, type Stored, type WriteOp, clientVersion, uniqueViolation } from './backend'
import {
  type FieldMeta,
  type ModelMeta,
  type Rec,
  allModels,
  cloneRec,
  model,
  modelByDelegate,
  relationLink,
  uniqueKey,
  uniqueKeys,
} from './schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>

// ───────────────────────────────── erreurs

function knownError(code: string, message: string): Error {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion })
}

const notFound = (what: string) =>
  knownError(
    'P2025',
    `An operation failed because it depends on one or more records that were required but not found. ${what}`,
  )

function unsupported(what: string): Error {
  return new Error(`Client de données : « ${what} » n'est pas pris en charge.`)
}

// ───────────────────────────────── identifiants

let compteur = 0

/** Identifiant de type cuid, croissant dans le temps : l'ordre d'insertion se conserve. */
export function newId(): string {
  compteur = (compteur + 1) % 1679616
  return (
    'c' +
    Date.now().toString(36).padStart(9, '0') +
    compteur.toString(36).padStart(4, '0') +
    randomBytes(8).toString('hex').slice(0, 11)
  )
}

// ───────────────────────────────── valeurs

const isPlainObject = (v: unknown): v is Args =>
  typeof v === 'object' && v !== null && !(v instanceof Date) && !Array.isArray(v)

function eq(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    if (a == null || b == null) return false
    return new Date(a as Date).getTime() === new Date(b as Date).getTime()
  }
  return a === b
}

function cmp(a: unknown, b: unknown): number {
  if (a instanceof Date || b instanceof Date) return new Date(a as Date).getTime() - new Date(b as Date).getTime()
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'fr')
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return (a as number) - (b as number)
}

const copyValue = (v: unknown) => (v instanceof Date ? new Date(v.getTime()) : v)
const arrayify = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

function matchScalar(v: unknown, cond: unknown): boolean {
  if (cond === undefined) return true
  if (cond === null) return v == null
  if (!isPlainObject(cond)) return eq(v, cond)
  const insensible = cond.mode === 'insensitive'
  const s = (x: unknown) => (insensible ? String(x).toLowerCase() : String(x))
  for (const [op, arg] of Object.entries(cond)) {
    if (arg === undefined) continue
    switch (op) {
      case 'equals':
        if (arg === null ? v != null : !eq(v, arg)) return false
        break
      case 'in':
        if (!(arg as unknown[]).some((x) => eq(v, x))) return false
        break
      case 'notIn':
        if (v == null || (arg as unknown[]).some((x) => eq(v, x))) return false
        break
      case 'not':
        if (arg === null) {
          if (v == null) return false
        } else if (isPlainObject(arg)) {
          if (v == null || matchScalar(v, arg)) return false
        } else if (v == null || eq(v, arg)) return false
        break
      case 'lt':
        if (v == null || cmp(v, arg) >= 0) return false
        break
      case 'lte':
        if (v == null || cmp(v, arg) > 0) return false
        break
      case 'gt':
        if (v == null || cmp(v, arg) <= 0) return false
        break
      case 'gte':
        if (v == null || cmp(v, arg) < 0) return false
        break
      case 'contains':
        if (v == null || !s(v).includes(s(arg))) return false
        break
      case 'startsWith':
        if (v == null || !s(v).startsWith(s(arg))) return false
        break
      case 'endsWith':
        if (v == null || !s(v).endsWith(s(arg))) return false
        break
      case 'mode':
        break
      default:
        throw unsupported(`filtre ${op}`)
    }
  }
  return true
}

// ───────────────────────────────── session : lectures cohérentes, écritures groupées

interface Staged {
  model: string
  id: string
  expect: number | null
  orig: Rec | null
  data: Rec | null
}

class Session {
  private tables = new Map<string, Promise<Map<string, Stored>>>()
  private staged = new Map<string, Staged>()

  constructor(private readonly backend: Backend) {}

  private table(name: string): Promise<Map<string, Stored>> {
    let t = this.tables.get(name)
    if (!t) this.tables.set(name, (t = this.backend.load(name)))
    return t
  }

  async rows(name: string): Promise<Rec[]> {
    const table = await this.table(name)
    const out: Rec[] = []
    for (const [id, s] of table) {
      const st = this.staged.get(`${name}#${id}`)
      if (!st) out.push(s.data)
      else if (st.data) out.push(st.data)
    }
    for (const st of this.staged.values()) {
      if (st.model === name && st.data && !table.has(st.id)) out.push(st.data)
    }
    return out
  }

  async exists(name: string, id: string): Promise<boolean> {
    const st = this.staged.get(`${name}#${id}`)
    if (st) return st.data !== null
    return (await this.table(name)).has(id)
  }

  async put(meta: ModelMeta, rec: Rec): Promise<void> {
    await this.stage(meta, String(rec[meta.idField]), rec)
  }

  async remove(meta: ModelMeta, id: string): Promise<void> {
    await this.stage(meta, id, null)
  }

  private async stage(meta: ModelMeta, id: string, data: Rec | null): Promise<void> {
    const key = `${meta.name}#${id}`
    const prev = this.staged.get(key)
    if (prev) {
      prev.data = data
      return
    }
    const stored = (await this.table(meta.name)).get(id)
    this.staged.set(key, { model: meta.name, id, expect: stored?.version ?? null, orig: stored?.data ?? null, data })
  }

  async flush(): Promise<void> {
    const ops: WriteOp[] = []
    for (const st of this.staged.values()) {
      if (st.expect === null && st.data === null) continue // créé puis supprimé
      const meta = model(st.model)
      const before = new Set(st.orig ? uniqueKeys(meta, st.orig) : [])
      const after = new Set(st.data ? uniqueKeys(meta, st.data) : [])
      ops.push({
        model: st.model,
        id: st.id,
        expect: st.expect,
        data: st.data,
        uniquesAdd: [...after].filter((k) => !before.has(k)),
        uniquesRemove: [...before].filter((k) => !after.has(k)),
      })
    }
    this.staged.clear()
    this.tables.clear()
    if (ops.length > 0) await this.backend.commit(ops)
  }
}

// ───────────────────────────────── relations

async function related(s: Session, meta: ModelMeta, row: Rec, field: FieldMeta): Promise<Rec | Rec[] | null> {
  const link = relationLink(meta, field)
  const rows = await s.rows(link.target.name)
  if (link.local) {
    if (link.from.some((f) => row[f] == null)) return null
    return rows.find((r) => link.to.every((t, i) => eq(r[t], row[link.from[i]]))) ?? null
  }
  const matches = rows.filter((r) => link.from.every((f, i) => eq(r[f], row[link.to[i]])))
  return field.isList ? matches : (matches[0] ?? null)
}

// ───────────────────────────────── filtres

async function matchWhere(s: Session, meta: ModelMeta, row: Rec, where: Args | undefined): Promise<boolean> {
  if (!where) return true
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue
    if (key === 'AND') {
      for (const w of arrayify(cond)) if (!(await matchWhere(s, meta, row, w))) return false
      continue
    }
    if (key === 'OR') {
      let any = false
      for (const w of arrayify(cond)) if (await matchWhere(s, meta, row, w)) any = true
      if (!any) return false
      continue
    }
    if (key === 'NOT') {
      for (const w of arrayify(cond)) if (await matchWhere(s, meta, row, w)) return false
      continue
    }
    const field = meta.fields.get(key)
    if (!field) {
      // Clé composée d'une contrainte unique : { taskId_userId: { taskId, userId } }
      if (isPlainObject(cond) && key.includes('_')) {
        if (!(await matchWhere(s, meta, row, cond))) return false
        continue
      }
      throw unsupported(`champ ${meta.name}.${key}`)
    }
    if (field.kind !== 'object') {
      if (!matchScalar(row[key], cond)) return false
      continue
    }
    const target = model(field.type)
    if (field.isList) {
      const list = (await related(s, meta, row, field)) as Rec[]
      const c = cond as Args
      if (c.some !== undefined) {
        let found = false
        for (const r of list) if (await matchWhere(s, target, r, c.some)) found = true
        if (!found) return false
      }
      if (c.every !== undefined) {
        for (const r of list) if (!(await matchWhere(s, target, r, c.every))) return false
      }
      if (c.none !== undefined) {
        for (const r of list) if (await matchWhere(s, target, r, c.none)) return false
      }
      continue
    }
    const one = (await related(s, meta, row, field)) as Rec | null
    if (cond === null) {
      if (one !== null) return false
      continue
    }
    const c = cond as Args
    if ('is' in c || 'isNot' in c) {
      if ('is' in c && (c.is === null ? one !== null : !one || !(await matchWhere(s, target, one, c.is)))) return false
      if ('isNot' in c && (c.isNot === null ? one === null : one && (await matchWhere(s, target, one, c.isNot))))
        return false
      continue
    }
    if (!one || !(await matchWhere(s, target, one, c))) return false
  }
  return true
}

async function filter(s: Session, meta: ModelMeta, rows: Rec[], where: Args | undefined): Promise<Rec[]> {
  if (!where) return rows
  const out: Rec[] = []
  for (const r of rows) if (await matchWhere(s, meta, r, where)) out.push(r)
  return out
}

// ───────────────────────────────── tri et pagination

async function sortRows(s: Session, meta: ModelMeta, rows: Rec[], orderBy: Args | Args[] | undefined): Promise<Rec[]> {
  if (!orderBy) return rows
  const specs: { path: string[]; dir: 1 | -1; nulls?: 'first' | 'last' }[] = []
  const walk = (o: Args, path: string[]) => {
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined) continue
      if (v === 'asc' || v === 'desc') specs.push({ path: [...path, k], dir: v === 'asc' ? 1 : -1 })
      else if (isPlainObject(v) && (v.sort === 'asc' || v.sort === 'desc'))
        specs.push({ path: [...path, k], dir: v.sort === 'asc' ? 1 : -1, nulls: v.nulls })
      else if (isPlainObject(v)) walk(v, [...path, k])
    }
  }
  for (const o of arrayify(orderBy)) walk(o, [])

  const keyed = await Promise.all(
    rows.map(async (row) => {
      const keys: unknown[] = []
      for (const spec of specs) {
        let current: Rec | null = row
        let currentMeta = meta
        for (const step of spec.path.slice(0, -1)) {
          const field = currentMeta.fields.get(step)
          if (!field || field.kind !== 'object' || field.isList) throw unsupported(`tri sur ${step}`)
          current = current ? ((await related(s, currentMeta, current, field)) as Rec | null) : null
          currentMeta = model(field.type)
        }
        keys.push(current ? current[spec.path[spec.path.length - 1]] : null)
      }
      return { row, keys }
    }),
  )

  keyed.sort((a, b) => {
    for (let i = 0; i < specs.length; i++) {
      const x = a.keys[i]
      const y = b.keys[i]
      if (x == null && y == null) continue
      // Comme PostgreSQL : les valeurs nulles en dernier en ordre croissant.
      const nullsFirst = specs[i].nulls ? specs[i].nulls === 'first' : specs[i].dir === -1
      if (x == null) return nullsFirst ? -1 : 1
      if (y == null) return nullsFirst ? 1 : -1
      const c = cmp(x, y) * specs[i].dir
      if (c !== 0) return c
    }
    return 0
  })
  return keyed.map((k) => k.row)
}

function paginate(rows: Rec[], args: Args): Rec[] {
  let out = rows
  if (args.skip) out = out.slice(args.skip)
  if (args.take !== undefined) out = args.take >= 0 ? out.slice(0, args.take) : out.slice(args.take)
  return out
}

async function query(s: Session, meta: ModelMeta, args: Args = {}): Promise<Rec[]> {
  if (args.cursor || args.distinct) throw unsupported('cursor / distinct')
  const rows = await filter(s, meta, await s.rows(meta.name), args.where)
  return paginate(await sortRows(s, meta, rows, args.orderBy), args)
}

// ───────────────────────────────── projection (select / include / _count)

async function counts(s: Session, meta: ModelMeta, row: Rec, spec: unknown): Promise<Rec> {
  const out: Rec = {}
  const wanted: [string, unknown][] =
    spec === true
      ? meta.relations.filter((f) => f.isList).map((f) => [f.name, true])
      : Object.entries((spec as Args).select ?? {})
  for (const [name, cond] of wanted) {
    if (!cond) continue
    const field = meta.fields.get(name)
    if (!field?.isList) throw unsupported(`_count sur ${name}`)
    const list = (await related(s, meta, row, field)) as Rec[]
    out[name] = isPlainObject(cond) ? (await filter(s, model(field.type), list, cond.where)).length : list.length
  }
  return out
}

async function nested(s: Session, meta: ModelMeta, row: Rec, field: FieldMeta, spec: unknown): Promise<unknown> {
  const args: Args = isPlainObject(spec) ? spec : {}
  const target = model(field.type)
  const value = await related(s, meta, row, field)
  if (field.isList) {
    let list = await filter(s, target, value as Rec[], args.where)
    list = paginate(await sortRows(s, target, list, args.orderBy), args)
    return Promise.all(list.map((r) => shape(s, target, r, args)))
  }
  return value ? shape(s, target, value as Rec, args) : null
}

async function shape(s: Session, meta: ModelMeta, row: Rec, args: Args = {}): Promise<Rec> {
  const out: Rec = {}
  if (args.select) {
    for (const [key, spec] of Object.entries(args.select as Args)) {
      if (!spec) continue
      if (key === '_count') {
        out._count = await counts(s, meta, row, spec)
        continue
      }
      const field = meta.fields.get(key)
      if (!field) throw unsupported(`select ${meta.name}.${key}`)
      out[key] = field.kind === 'object' ? await nested(s, meta, row, field, spec) : copyValue(row[key])
    }
    return out
  }
  for (const f of meta.scalars) out[f.name] = copyValue(row[f.name])
  for (const [key, spec] of Object.entries((args.include ?? {}) as Args)) {
    if (!spec) continue
    if (key === '_count') {
      out._count = await counts(s, meta, row, spec)
      continue
    }
    const field = meta.fields.get(key)
    if (!field || field.kind !== 'object') throw unsupported(`include ${meta.name}.${key}`)
    out[key] = await nested(s, meta, row, field, spec)
  }
  return out
}

// ───────────────────────────────── écritures

async function checkUniques(s: Session, meta: ModelMeta, rec: Rec, selfId: unknown): Promise<void> {
  const rows = await s.rows(meta.name)
  const id = meta.idField
  if (selfId === null && rows.some((r) => eq(r[id], rec[id]))) throw uniqueViolation(`${meta.name}#${id}=`)
  for (const fields of meta.uniques) {
    const key = uniqueKey(meta, fields, rec)
    if (key && rows.some((r) => !eq(r[id], selfId) && uniqueKey(meta, fields, r) === key)) throw uniqueViolation(key)
  }
}

async function checkForeignKeys(s: Session, meta: ModelMeta, rec: Rec): Promise<void> {
  for (const field of meta.relations) {
    if (!field.relationFromFields?.length) continue
    const values = field.relationFromFields.map((f) => rec[f])
    if (values.some((v) => v == null)) {
      if (field.isRequired) throw new Error(`Champ requis manquant : ${meta.name}.${field.relationFromFields.join(', ')}`)
      continue
    }
    const target = model(field.type)
    const to = field.relationToFields ?? []
    const ok =
      to.length === 1 && to[0] === target.idField
        ? await s.exists(target.name, String(values[0]))
        : (await s.rows(target.name)).some((r) => to.every((t, i) => eq(r[t], values[i])))
    if (!ok) throw knownError('P2003', `Foreign key constraint violated on the field: \`${field.relationFromFields.join(', ')}\``)
  }
}

function defaultValue(f: FieldMeta): unknown {
  const d = f.default
  if (d === undefined) return undefined
  if (isPlainObject(d)) {
    if (d.name === 'cuid' || d.name === 'uuid') return newId()
    if (d.name === 'now') return new Date()
    throw unsupported(`valeur par défaut ${d.name}()`)
  }
  return d
}

async function findOne(s: Session, meta: ModelMeta, where: Args): Promise<Rec | null> {
  const rows = await s.rows(meta.name)
  // Raccourci par identifiant, le cas le plus fréquent.
  const id = where[meta.idField]
  if (typeof id === 'string' && Object.keys(where).length === 1) return rows.find((r) => r[meta.idField] === id) ?? null
  for (const r of rows) if (await matchWhere(s, meta, r, where)) return r
  return null
}

/** Relie à l'enregistrement parent les enfants d'une relation de type liste. */
function withParent(link: ReturnType<typeof relationLink>, parent: Rec, child: Args): Args {
  const data: Args = { ...child }
  link.from.forEach((f, i) => (data[f] = parent[link.to[i]]))
  return data
}

async function connectLocal(s: Session, meta: ModelMeta, field: FieldMeta, rec: Rec, op: Args): Promise<void> {
  const link = relationLink(meta, field)
  if ('connect' in op) {
    const target = await findOne(s, link.target, op.connect)
    if (!target) throw notFound(`No '${link.target.name}' record found for a nested connect.`)
    link.from.forEach((f, i) => (rec[f] = target[link.to[i]]))
  } else if ('disconnect' in op) {
    link.from.forEach((f) => (rec[f] = null))
  } else {
    throw unsupported(`écriture imbriquée ${meta.name}.${field.name} (${Object.keys(op).join(', ')})`)
  }
}

async function writeChildren(s: Session, meta: ModelMeta, parent: Rec, field: FieldMeta, op: Args): Promise<void> {
  const link = relationLink(meta, field)
  const target = link.target
  for (const [kind, arg] of Object.entries(op)) {
    if (arg === undefined) continue
    switch (kind) {
      case 'create':
        for (const child of arrayify(arg)) await createRecord(s, target, withParent(link, parent, child))
        break
      case 'createMany':
        for (const child of arrayify(arg.data)) {
          try {
            await createRecord(s, target, withParent(link, parent, child))
          } catch (error) {
            if (!(arg.skipDuplicates && (error as { code?: string }).code === 'P2002')) throw error
          }
        }
        break
      case 'connect':
        for (const w of arrayify(arg)) {
          const child = await findOne(s, target, w)
          if (!child) throw notFound(`No '${target.name}' record found for a nested connect.`)
          await updateRecord(s, target, child, withParent(link, parent, {}))
        }
        break
      case 'deleteMany':
      case 'delete': {
        const children = (await related(s, meta, parent, field)) as Rec[]
        for (const w of arrayify(arg)) {
          const matches = await filter(s, target, children, w === true ? undefined : w)
          if (kind === 'delete' && matches.length === 0) throw notFound('Record to delete does not exist.')
          for (const c of matches) {
            if (await s.exists(target.name, String(c[target.idField]))) await deleteRecord(s, target, c)
          }
        }
        break
      }
      default:
        throw unsupported(`écriture imbriquée ${meta.name}.${field.name}.${kind}`)
    }
  }
}

async function createRecord(s: Session, meta: ModelMeta, data: Args): Promise<Rec> {
  const rec: Rec = {}
  const children: [FieldMeta, Args][] = []
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    const field = meta.fields.get(key)
    if (!field) throw unsupported(`champ ${meta.name}.${key}`)
    if (field.kind === 'object') {
      if (field.relationFromFields?.length) await connectLocal(s, meta, field, rec, value)
      else children.push([field, value])
      continue
    }
    rec[key] = copyValue(value)
  }
  for (const f of meta.scalars) {
    if (rec[f.name] !== undefined) continue
    if (f.isUpdatedAt) rec[f.name] = new Date()
    else if (f.default !== undefined) rec[f.name] = defaultValue(f)
    else if (!f.isRequired) rec[f.name] = null
    else throw new Error(`Argument \`${f.name}\` is missing (${meta.name}).`)
  }
  await checkForeignKeys(s, meta, rec)
  await checkUniques(s, meta, rec, null)
  await s.put(meta, rec)
  for (const [field, op] of children) await writeChildren(s, meta, rec, field, op)
  return rec
}

async function updateRecord(s: Session, meta: ModelMeta, row: Rec, data: Args): Promise<Rec> {
  const next = cloneRec(row)
  const children: [FieldMeta, Args][] = []
  let fkChanged = false
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    const field = meta.fields.get(key)
    if (!field) throw unsupported(`champ ${meta.name}.${key}`)
    if (field.kind === 'object') {
      if (field.relationFromFields?.length) {
        await connectLocal(s, meta, field, next, value)
        fkChanged = true
      } else children.push([field, value])
      continue
    }
    if (field.isId && !eq(value, row[key])) throw unsupported(`modification de l'identifiant ${meta.name}.${key}`)
    if (isPlainObject(value)) {
      const current = (next[key] as number) ?? 0
      if ('set' in value) next[key] = copyValue(value.set)
      else if ('increment' in value) next[key] = current + value.increment
      else if ('decrement' in value) next[key] = current - value.decrement
      else if ('multiply' in value) next[key] = current * value.multiply
      else if ('divide' in value) next[key] = current / value.divide
      else throw unsupported(`opération ${Object.keys(value).join(', ')} sur ${meta.name}.${key}`)
    } else {
      next[key] = copyValue(value)
    }
    if (meta.relations.some((r) => r.relationFromFields?.includes(key))) fkChanged = true
  }
  for (const f of meta.scalars) if (f.isUpdatedAt && data[f.name] === undefined) next[f.name] = new Date()
  if (fkChanged) await checkForeignKeys(s, meta, next)
  await checkUniques(s, meta, next, row[meta.idField])
  await s.put(meta, next)
  for (const [field, op] of children) await writeChildren(s, meta, next, field, op)
  return next
}

async function deleteRecord(s: Session, meta: ModelMeta, row: Rec): Promise<void> {
  for (const child of allModels()) {
    for (const field of child.relations) {
      if (field.type !== meta.name || !field.relationFromFields?.length) continue
      const from = field.relationFromFields
      const to = field.relationToFields ?? []
      const dependents = (await s.rows(child.name)).filter((c) => from.every((f, i) => eq(c[f], row[to[i]])))
      if (dependents.length === 0) continue
      const action = field.relationOnDelete ?? (field.isRequired ? 'Restrict' : 'SetNull')
      for (const dep of dependents) {
        if (!(await s.exists(child.name, String(dep[child.idField])))) continue
        if (action === 'Cascade') await deleteRecord(s, child, dep)
        else if (action === 'SetNull') {
          const next = cloneRec(dep)
          from.forEach((f) => (next[f] = null))
          await s.put(child, next)
        } else {
          throw knownError(
            'P2003',
            `Foreign key constraint violated: \`${child.name}.${from.join(', ')}\` (suppression de ${meta.name})`,
          )
        }
      }
    }
  }
  await s.remove(meta, String(row[meta.idField]))
}

// ───────────────────────────────── agrégats

function aggregateRows(meta: ModelMeta, rows: Rec[], args: Args): Rec {
  const out: Rec = {}
  const numeric = (field: string) => rows.map((r) => r[field]).filter((v): v is number => typeof v === 'number')
  for (const [kind, spec] of Object.entries(args)) {
    if (!['_sum', '_avg', '_min', '_max', '_count'].includes(kind) || !spec) continue
    if (kind === '_count') {
      if (spec === true) {
        out._count = rows.length
        continue
      }
      const c: Rec = {}
      for (const [field, on] of Object.entries(spec as Args)) {
        if (!on) continue
        c[field] = field === '_all' ? rows.length : rows.filter((r) => r[field] != null).length
      }
      out._count = c
      continue
    }
    const res: Rec = {}
    for (const [field, on] of Object.entries(spec as Args)) {
      if (!on) continue
      const values = kind === '_min' || kind === '_max' ? rows.map((r) => r[field]).filter((v) => v != null) : numeric(field)
      if (values.length === 0) {
        res[field] = null
        continue
      }
      if (kind === '_sum') res[field] = (values as number[]).reduce((a, b) => a + b, 0)
      if (kind === '_avg') res[field] = (values as number[]).reduce((a, b) => a + b, 0) / values.length
      if (kind === '_min') res[field] = copyValue([...values].sort(cmp)[0])
      if (kind === '_max') res[field] = copyValue([...values].sort(cmp)[values.length - 1])
    }
    out[kind] = res
  }
  void meta
  return out
}

// ───────────────────────────────── délégués et client

type Runner = <T>(fn: (s: Session) => Promise<T>) => Promise<T>

function delegate(meta: ModelMeta, run: Runner) {
  const one = async (s: Session, args: Args) => (await query(s, meta, { ...args, take: 1 }))[0] ?? null
  const unique = (s: Session, where: Args) => findOne(s, meta, where)

  return {
    findUnique: (args: Args) =>
      run(async (s) => {
        const row = await unique(s, args.where)
        return row ? shape(s, meta, row, args) : null
      }),
    findUniqueOrThrow: (args: Args) =>
      run(async (s) => {
        const row = await unique(s, args.where)
        if (!row) throw notFound(`No ${meta.name} found`)
        return shape(s, meta, row, args)
      }),
    findFirst: (args: Args = {}) =>
      run(async (s) => {
        const row = await one(s, args)
        return row ? shape(s, meta, row, args) : null
      }),
    findFirstOrThrow: (args: Args = {}) =>
      run(async (s) => {
        const row = await one(s, args)
        if (!row) throw notFound(`No ${meta.name} found`)
        return shape(s, meta, row, args)
      }),
    findMany: (args: Args = {}) =>
      run(async (s) => Promise.all((await query(s, meta, args)).map((r) => shape(s, meta, r, args)))),
    count: (args: Args = {}) => run(async (s) => (await query(s, meta, args)).length),

    create: (args: Args) =>
      run(async (s) => {
        const row = await createRecord(s, meta, args.data)
        return shape(s, meta, row, args)
      }),
    createMany: (args: Args) =>
      run(async (s) => {
        let count = 0
        for (const data of arrayify(args.data)) {
          try {
            await createRecord(s, meta, data)
            count++
          } catch (error) {
            if (!(args.skipDuplicates && (error as { code?: string }).code === 'P2002')) throw error
          }
        }
        return { count }
      }),
    update: (args: Args) =>
      run(async (s) => {
        const row = await unique(s, args.where)
        if (!row) throw notFound('Record to update not found.')
        return shape(s, meta, await updateRecord(s, meta, row, args.data), args)
      }),
    updateMany: (args: Args = {}) =>
      run(async (s) => {
        const rows = await query(s, meta, { where: args.where })
        for (const row of rows) await updateRecord(s, meta, row, args.data)
        return { count: rows.length }
      }),
    upsert: (args: Args) =>
      run(async (s) => {
        const row = await unique(s, args.where)
        const result = row ? await updateRecord(s, meta, row, args.update) : await createRecord(s, meta, args.create)
        return shape(s, meta, result, args)
      }),
    delete: (args: Args) =>
      run(async (s) => {
        const row = await unique(s, args.where)
        if (!row) throw notFound('Record to delete does not exist.')
        const result = await shape(s, meta, row, args)
        await deleteRecord(s, meta, row)
        return result
      }),
    deleteMany: (args: Args = {}) =>
      run(async (s) => {
        const rows = await query(s, meta, { where: args.where })
        let count = 0
        for (const row of rows) {
          if (!(await s.exists(meta.name, String(row[meta.idField])))) continue
          await deleteRecord(s, meta, row)
          count++
        }
        return { count }
      }),
    aggregate: (args: Args = {}) => run(async (s) => aggregateRows(meta, await query(s, meta, args), args)),
    groupBy: (args: Args) =>
      run(async (s) => {
        if (args.having) throw unsupported('groupBy having')
        const by = arrayify<string>(args.by)
        const rows = await query(s, meta, { where: args.where })
        const groups = new Map<string, Rec[]>()
        for (const r of rows) {
          const key = JSON.stringify(by.map((f) => (r[f] instanceof Date ? (r[f] as Date).toISOString() : r[f])))
          groups.set(key, [...(groups.get(key) ?? []), r])
        }
        const out = [...groups.values()].map((g) => {
          const res: Rec = {}
          for (const f of by) res[f] = copyValue(g[0][f])
          return { ...res, ...aggregateRows(meta, g, args) }
        })
        return paginate(await sortRows(s, meta, out, args.orderBy), args)
      }),
  }
}

function clientFor(backend: Backend, tx: Session | null): Record<string, unknown> {
  const run: Runner = async (fn) => {
    if (tx) return fn(tx)
    const s = new Session(backend)
    const result = await fn(s)
    await s.flush()
    return result
  }
  const delegates = new Map<string, ReturnType<typeof delegate>>()

  return new Proxy(
    {
      async $transaction(arg: unknown) {
        if (Array.isArray(arg)) return Promise.all(arg)
        if (typeof arg !== 'function') throw unsupported('$transaction')
        if (tx) return arg(clientFor(backend, tx))
        const session = new Session(backend)
        const result = await arg(clientFor(backend, session))
        await session.flush()
        return result
      },
      async $connect() {},
      async $disconnect() {},
    } as Record<string, unknown>,
    {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined
        if (prop in target) return target[prop]
        const meta = modelByDelegate(prop)
        if (!meta) return undefined
        let d = delegates.get(prop)
        if (!d) delegates.set(prop, (d = delegate(meta, run)))
        return d
      },
    },
  )
}

/** Crée un client au contrat de PrismaClient sur le magasin donné. */
export function createDb(backend: Backend): PrismaClient {
  return clientFor(backend, null) as unknown as PrismaClient
}
