export const MAX_PHOTOS_PER_SUBMISSION = 3
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'] as const
export type AllowedFormat = (typeof ALLOWED_FORMATS)[number]

export interface IncomingPhoto {
  sizeBytes: number
  /** Format RÉEL détecté en lisant le fichier, jamais déduit de l'extension. */
  format: string | null
  originalName: string
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadError'
  }
}

export function assertBatchAllowed(files: IncomingPhoto[], existingCount: number): void {
  if (existingCount + files.length > MAX_PHOTOS_PER_SUBMISSION) {
    throw new UploadError(`Une soumission accepte au maximum ${MAX_PHOTOS_PER_SUBMISSION} photos.`)
  }

  for (const file of files) {
    if (file.sizeBytes <= 0) {
      throw new UploadError(`Le fichier « ${file.originalName} » est vide.`)
    }
    if (file.sizeBytes > MAX_PHOTO_BYTES) {
      throw new UploadError(`Le fichier « ${file.originalName} » dépasse 8 Mo.`)
    }
    if (file.format === null) {
      throw new UploadError(`Le fichier « ${file.originalName} » n'est pas une image.`)
    }
    if (!ALLOWED_FORMATS.includes(file.format as AllowedFormat)) {
      throw new UploadError(`Le fichier « ${file.originalName} » doit être au format JPEG, PNG ou WebP.`)
    }
  }
}
