import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { exportAllCsv } from '@/lib/services/exportService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('sauvegarde CSV', () => {
  let t: TestDb
  let admin: Actor
  let chef: Actor

  beforeEach(async () => {
    t = await createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({
        data: { username, displayName: username, passwordHash: 'argon2-empreinte-secrete', role },
      })
      return { id: u.id, role, displayName: username }
    }
    admin = await mk('admin', 'SUPER_ADMIN')
    chef = await mk('sarah', 'CHEF')
    await t.prisma.session.create({
      data: { id: 'jeton-secret', userId: chef.id, expiresAt: new Date(Date.now() + 1e7) },
    })
    await t.prisma.project.create({ data: { title: 'Camp; "été"' } })
  })
  afterEach(async () => {
    await t.cleanup()
  })

  it('exporte toutes les tables, sans les secrets', async () => {
    const { csv, tables } = await exportAllCsv(t.prisma, admin)

    expect(tables.map((x) => x.nom)).toContain('Project')
    expect(tables.map((x) => x.nom)).not.toContain('Session')
    expect(tables.find((x) => x.nom === 'User')?.colonnes).not.toContain('passwordHash')
    expect(csv).toContain('# User (2)')
    expect(csv).toContain('"Camp; ""été"""')
    expect(csv).not.toContain('argon2-empreinte-secrete')
    expect(csv).not.toContain('jeton-secret')
  })

  it('est réservée au super admin', async () => {
    await expect(exportAllCsv(t.prisma, chef)).rejects.toThrow()
  })
})
