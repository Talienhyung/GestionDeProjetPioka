// src/app/api/export/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { nomFichierExport } from '@/lib/domain/exportCsv'
import { exportAllCsv } from '@/lib/services/exportService'

/** Sauvegarde de toutes les données en CSV, téléchargée par le super admin. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return new NextResponse('Non autorisé', { status: 401 })

  const { csv } = await exportAllCsv(db, user)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomFichierExport(new Date())}"`,
      'Cache-Control': 'no-store',
    },
  })
}
