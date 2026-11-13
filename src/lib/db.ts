import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Un seul client par processus : en développement le rechargement à chaud
// réévalue ce module, et sur Amplify une fonction « chaude » sert plusieurs
// requêtes. Chaque nouveau client ouvrirait son propre lot de connexions.
export const db = globalForPrisma.prisma ?? new PrismaClient()
globalForPrisma.prisma = db

/** Client Prisma ou client de transaction : ce que les services acceptent. */
export type Db = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
