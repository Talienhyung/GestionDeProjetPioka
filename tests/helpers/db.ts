import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { MemoryBackend } from '@/lib/data/backend'
import { createDb } from '@/lib/data/client'
import { DynamoBackend, dynamoClient } from '@/lib/data/dynamoBackend'

export interface TestDb {
  prisma: PrismaClient
  cleanup: () => Promise<void>
}

/**
 * Une base vide et isolée par test.
 * - Par défaut en mémoire : instantané.
 * - Avec TEST_DYNAMODB_TABLE (et DYNAMODB_ENDPOINT pour DynamoDB Local), les
 *   mêmes tests tournent contre DynamoDB, chacun sous un préfixe de clés à lui.
 */
export async function createTestDb(): Promise<TestDb> {
  const table = process.env.TEST_DYNAMODB_TABLE
  const backend = table
    ? new DynamoBackend(dynamoClient(), table, `t${randomBytes(6).toString('hex')}:`)
    : new MemoryBackend()
  return { prisma: createDb(backend), cleanup: async () => {} }
}
