import type { PrismaClient } from '@prisma/client'
import { type Backend, FileBackend } from '@/lib/data/backend'
import { createDb } from '@/lib/data/client'
import { DynamoBackend, dynamoClient } from '@/lib/data/dynamoBackend'

/**
 * Où vivent les données :
 * - DYNAMODB_TABLE défini (Amplify) : une table DynamoDB ;
 * - sinon un fichier JSON (DATA_FILE, par défaut .data/cap.json) : le poste
 *   de développement et l'hébergement Docker sur un seul serveur.
 */
export function backendFromEnv(): Backend {
  const table = process.env.DYNAMODB_TABLE
  if (table) return new DynamoBackend(dynamoClient(), table)
  return new FileBackend(process.env.DATA_FILE ?? '.data/cap.json')
}

const globalForDb = globalThis as unknown as { capDb?: PrismaClient }

// Un client au contrat de PrismaClient : les services n'ont pas à savoir où
// sont les données. Un seul par processus : le rechargement à chaud réévalue ce module,
// et sur Amplify une fonction « chaude » sert plusieurs requêtes.
export const db = globalForDb.capDb ?? createDb(backendFromEnv())
globalForDb.capDb = db

/** Client ou client de transaction : ce que les services acceptent. */
export type Db = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
