import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { MAX_PHOTO_BYTES, UploadError, assertBatchAllowed } from '@/lib/domain/uploads'
import { type ObjectStore, s3StoreFromEnv } from '@/lib/s3Store'

export interface StoredPhoto {
  storedName: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
}

const MAX_EDGE = 1600

/**
 * Où vivent les photos. Avec S3_BUCKET (Amplify), dans un bucket S3 privé ;
 * sinon dans un dossier du disque (UPLOAD_DIR), pour Docker et le poste.
 * Dans les deux cas les photos ne sont servies que par /api/fichiers, après
 * vérification de la session : le bucket n'est jamais public.
 */
function store(): ObjectStore {
  return s3StoreFromEnv() ?? diskStore(process.env.UPLOAD_DIR ?? './.uploads')
}

function diskStore(dir: string): ObjectStore {
  return {
    async put(name, data) {
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, name), data)
    },
    get: (name) => readFile(join(dir, name)),
    async remove(name) {
      await unlink(join(dir, name)).catch(() => undefined)
    },
  }
}

function assertSafeName(storedName: string): void {
  if (!/^[a-f0-9]{32}\.webp$/.test(storedName)) {
    throw new UploadError('Nom de fichier invalide.')
  }
}

/**
 * Valide, réencode en WebP sans métadonnées, redimensionne et enregistre.
 * Rien n'est écrit tant que l'image n'a pas été décodée avec succès.
 */
export async function storePhoto(buffer: Buffer, originalName: string): Promise<StoredPhoto> {
  let format: string | null = null
  try {
    format = (await sharp(buffer).metadata()).format ?? null
  } catch {
    format = null
  }

  assertBatchAllowed([{ sizeBytes: buffer.byteLength, format, originalName }], 0)
  if (buffer.byteLength > MAX_PHOTO_BYTES) throw new UploadError(`Le fichier « ${originalName} » dépasse 8 Mo.`)

  // sharp ne recopie pas les métadonnées par défaut : l'EXIF, donc la
  // géolocalisation éventuelle, disparaît au réencodage.
  const output = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })

  const storedName = `${randomBytes(16).toString('hex')}.webp`
  await store().put(storedName, output.data, 'image/webp')

  return {
    storedName,
    originalName,
    mimeType: 'image/webp',
    sizeBytes: output.data.byteLength,
    width: output.info.width,
    height: output.info.height,
  }
}

export async function readPhoto(storedName: string): Promise<Buffer> {
  assertSafeName(storedName)
  return store().get(storedName)
}

export async function deletePhoto(storedName: string): Promise<void> {
  assertSafeName(storedName)
  await store().remove(storedName)
}
