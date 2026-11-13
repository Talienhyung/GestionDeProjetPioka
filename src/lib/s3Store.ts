import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/** Un endroit où ranger des fichiers par nom. */
export interface ObjectStore {
  put(name: string, data: Buffer, contentType: string): Promise<void>
  get(name: string): Promise<Buffer>
  remove(name: string): Promise<void>
}

/** Le strict nécessaire d'un client S3 : permet de tester sans AWS. */
export interface S3Like {
  send(command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand): Promise<unknown>
}

/** Préfixe des clés dans le bucket, pour pouvoir le partager sans mélange. */
const PREFIX = 'photos/'

export function createS3Store(client: S3Like, bucket: string): ObjectStore {
  return {
    async put(name, data, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: PREFIX + name,
          Body: data,
          ContentType: contentType,
          // Chiffrement au repos géré par S3.
          ServerSideEncryption: 'AES256',
        }),
      )
    },

    async get(name) {
      const result = (await client.send(new GetObjectCommand({ Bucket: bucket, Key: PREFIX + name }))) as {
        Body?: { transformToByteArray(): Promise<Uint8Array> }
      }
      if (!result.Body) throw new Error(`Objet vide : ${name}`)
      return Buffer.from(await result.Body.transformToByteArray())
    },

    async remove(name) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: PREFIX + name })).catch(() => undefined)
    },
  }
}

let cached: { bucket: string; store: ObjectStore } | null = null

/**
 * Magasin S3 configuré par l'environnement, ou null sans S3_BUCKET.
 * Les identifiants viennent de la chaîne par défaut du SDK : sur Amplify,
 * le rôle de calcul SSR ; aucune clé d'accès n'est à mettre en variable.
 * S3_REGION plutôt qu'AWS_REGION : Amplify réserve le préfixe AWS_.
 */
export function s3StoreFromEnv(): ObjectStore | null {
  const bucket = process.env.S3_BUCKET
  if (!bucket) return null
  if (cached?.bucket !== bucket) {
    const client = new S3Client({
      region: process.env.S3_REGION ?? process.env.AWS_REGION ?? 'eu-west-3',
      // S3_ENDPOINT : uniquement pour un S3 compatible en local (MinIO).
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
    })
    cached = { bucket, store: createS3Store(client, bucket) }
  }
  return cached.store
}
