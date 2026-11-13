// tests/unit/s3Store.test.ts
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { describe, expect, it } from 'vitest'
import { type S3Like, createS3Store } from '@/lib/s3Store'

/** Un faux S3 en mémoire, qui garde trace des commandes reçues. */
function fauxS3() {
  const objets = new Map<string, Buffer>()
  const commandes: { type: string; input: Record<string, unknown> }[] = []
  const client: S3Like = {
    async send(command) {
      const input = command.input as unknown as Record<string, unknown>
      commandes.push({ type: command.constructor.name, input })
      const key = `${input.Bucket}/${input.Key}`
      if (command instanceof PutObjectCommand) objets.set(key, input.Body as Buffer)
      if (command instanceof GetObjectCommand) {
        const data = objets.get(key)
        if (!data) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' })
        return { Body: { transformToByteArray: async () => new Uint8Array(data) } }
      }
      if (command instanceof DeleteObjectCommand) objets.delete(key)
      return {}
    },
  }
  return { client, objets, commandes }
}

describe('createS3Store', () => {
  it('range les photos sous photos/, chiffrées, et les relit', async () => {
    const s3 = fauxS3()
    const store = createS3Store(s3.client, 'cap-photos')

    await store.put('abc.webp', Buffer.from('image'), 'image/webp')
    expect(s3.commandes[0].input).toMatchObject({
      Bucket: 'cap-photos',
      Key: 'photos/abc.webp',
      ContentType: 'image/webp',
      ServerSideEncryption: 'AES256',
    })
    expect((await store.get('abc.webp')).toString()).toBe('image')
  })

  it('supprime sans échouer, même si la photo a déjà disparu', async () => {
    const s3 = fauxS3()
    const store = createS3Store(s3.client, 'cap-photos')
    await store.put('abc.webp', Buffer.from('image'), 'image/webp')

    await store.remove('abc.webp')
    await store.remove('abc.webp')
    expect(s3.objets.size).toBe(0)
    await expect(store.get('abc.webp')).rejects.toThrow()
  })
})
