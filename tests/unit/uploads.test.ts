// tests/unit/uploads.test.ts
import { describe, expect, it } from 'vitest'
import { MAX_PHOTOS_PER_SUBMISSION, UploadError, assertBatchAllowed } from '@/lib/domain/uploads'

const photo = (over = {}) => ({ sizeBytes: 1_000, format: 'jpeg', originalName: 'photo.jpg', ...over })

describe('assertBatchAllowed', () => {
  it('accepte un lot valide', () => {
    expect(() => assertBatchAllowed([photo(), photo()], 0)).not.toThrow()
  })

  it('accepte un envoi sans photo', () => {
    expect(() => assertBatchAllowed([], 0)).not.toThrow()
  })

  it('refuse au delà de 3 photos, en comptant celles déjà présentes', () => {
    expect(() => assertBatchAllowed([photo(), photo(), photo(), photo()], 0)).toThrow(UploadError)
    expect(() => assertBatchAllowed([photo(), photo()], 2)).toThrow(/3 photos/)
    expect(MAX_PHOTOS_PER_SUBMISSION).toBe(3)
  })

  it('refuse un fichier de plus de 8 Mo', () => {
    expect(() => assertBatchAllowed([photo({ sizeBytes: 9 * 1024 * 1024 })], 0)).toThrow(/8 Mo/)
  })

  it('refuse un fichier vide', () => {
    expect(() => assertBatchAllowed([photo({ sizeBytes: 0 })], 0)).toThrow(/vide/i)
  })

  it('refuse un format non image, quelle que soit l extension', () => {
    expect(() => assertBatchAllowed([photo({ format: null, originalName: 'virus.jpg' })], 0)).toThrow(/image/i)
    expect(() => assertBatchAllowed([photo({ format: 'gif' })], 0)).toThrow(/JPEG, PNG ou WebP/)
  })

  it('nomme le fichier fautif dans le message', () => {
    expect(() => assertBatchAllowed([photo({ format: 'pdf', originalName: 'dossier.pdf' })], 0)).toThrow(/dossier\.pdf/)
  })
})
