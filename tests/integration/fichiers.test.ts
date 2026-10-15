// tests/integration/fichiers.test.ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/guard', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { attachment: { findUnique: vi.fn() } } }))
vi.mock('@/lib/storage', () => ({ readPhoto: vi.fn() }))

const { getCurrentUser } = await import('@/lib/auth/guard')
const { db } = await import('@/lib/db')
const { readPhoto } = await import('@/lib/storage')
const { GET } = await import('@/app/api/fichiers/[id]/route')

const params = Promise.resolve({ id: 'att-1' })

describe('GET /api/fichiers/[id]', () => {
  it('refuse sans session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const response = await GET(new Request('http://x/api/fichiers/att-1'), { params })
    expect(response.status).toBe(401)
    expect(readPhoto).not.toHaveBeenCalled()
  })

  it('sert la photo à un utilisateur connecté', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'JEUNE', displayName: 'Lucie', mustChangePassword: false })
    vi.mocked(db.attachment.findUnique).mockResolvedValue({
      id: 'att-1', storedName: 'abc.webp', mimeType: 'image/webp', originalName: 'photo.jpg',
    } as never)
    vi.mocked(readPhoto).mockResolvedValue(Buffer.from('image'))

    const response = await GET(new Request('http://x/api/fichiers/att-1'), { params })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toContain('private')
  })

  it('rend 404 si la pièce jointe n existe pas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'JEUNE', displayName: 'Lucie', mustChangePassword: false })
    vi.mocked(db.attachment.findUnique).mockResolvedValue(null as never)

    expect((await GET(new Request('http://x/api/fichiers/att-1'), { params })).status).toBe(404)
  })
})
