// tests/integration/storage.test.ts
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'cap-uploads-'))
  process.env.UPLOAD_DIR = dir
})
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

async function jpegAvecExif(width = 2400, height = 1200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 80 } } })
    .withExif({ IFD0: { Copyright: 'Caravane', Software: 'test' } })
    .jpeg()
    .toBuffer()
}

describe('storePhoto', () => {
  it('réencode en WebP, redimensionne et supprime les métadonnées EXIF', async () => {
    const { storePhoto } = await import('@/lib/storage')
    const stored = await storePhoto(await jpegAvecExif(), 'photo du camp.jpg')

    expect(stored.mimeType).toBe('image/webp')
    expect(stored.width).toBe(1600)
    expect(stored.height).toBe(800)
    expect(stored.storedName).toMatch(/^[a-f0-9]{32}\.webp$/)
    expect(stored.originalName).toBe('photo du camp.jpg')

    const meta = await sharp(await readFile(join(dir, stored.storedName))).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.exif).toBeUndefined()
  })

  it('n agrandit pas une petite image', async () => {
    const { storePhoto } = await import('@/lib/storage')
    const stored = await storePhoto(await jpegAvecExif(400, 300), 'petite.jpg')
    expect(stored.width).toBe(400)
  })

  it('refuse un fichier qui n est pas une image', async () => {
    const { storePhoto } = await import('@/lib/storage')
    await expect(storePhoto(Buffer.from('bonjour, je ne suis pas une image'), 'faux.jpg'))
      .rejects.toThrow(/n'est pas une image/)
  })

  it('relit puis supprime un fichier stocké', async () => {
    const { deletePhoto, readPhoto, storePhoto } = await import('@/lib/storage')
    const stored = await storePhoto(await jpegAvecExif(600, 600), 'carre.jpg')

    expect((await readPhoto(stored.storedName)).length).toBeGreaterThan(0)

    await deletePhoto(stored.storedName)
    await expect(readPhoto(stored.storedName)).rejects.toThrow()
    await expect(deletePhoto(stored.storedName)).resolves.toBeUndefined()
  })

  it('refuse un nom de fichier contenant un chemin', async () => {
    const { readPhoto } = await import('@/lib/storage')
    await expect(readPhoto('../../etc/passwd')).rejects.toThrow(/nom de fichier/i)
  })

describe('limite de taille', () => {
  it('refuse une vraie image de plus de 8 Mo sans rien écrire sur le disque', async () => {
    const { storePhoto } = await import('@/lib/storage')
    const { readdirSync } = await import('node:fs')

    // Du bruit aléatoire : incompressible, donc le PNG dépasse franchement 8 Mo.
    const largeur = 2600
    const hauteur = 2600
    const bruit = Buffer.allocUnsafe(largeur * hauteur * 3)
    for (let i = 0; i < bruit.length; i += 1) bruit[i] = (i * 2654435761) % 256
    const enorme = await sharp(bruit, { raw: { width: largeur, height: hauteur, channels: 3 } })
      .png({ compressionLevel: 0 })
      .toBuffer()
    expect(enorme.byteLength).toBeGreaterThan(8 * 1024 * 1024)

    const avant = readdirSync(dir).length
    await expect(storePhoto(enorme, 'enorme.png')).rejects.toThrow(/8 Mo/)
    expect(readdirSync(dir).length).toBe(avant)
  })
})
})
