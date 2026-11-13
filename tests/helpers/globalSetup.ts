import { dynamoClient, ensureTable } from '@/lib/data/dynamoBackend'

/**
 * Avec TEST_DYNAMODB_TABLE, crée la table de test (DynamoDB Local) si elle
 * manque. Sans, rien à préparer : les tests tournent en mémoire.
 */
export default async function setup() {
  const table = process.env.TEST_DYNAMODB_TABLE
  if (table) await ensureTable(dynamoClient(), table)
}
