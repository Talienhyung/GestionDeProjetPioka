import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/** Client Prisma ou client de transaction : ce que les services acceptent. */
export type Db = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
