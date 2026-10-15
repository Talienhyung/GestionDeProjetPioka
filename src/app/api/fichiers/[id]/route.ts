// src/app/api/fichiers/[id]/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { readPhoto } from '@/lib/storage'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Photos de mineurs : aucune n'est servie sans session valide.
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Non autorisé', { status: 401 })

  const { id } = await params
  const attachment = await db.attachment.findUnique({ where: { id } })
  if (!attachment) return new NextResponse('Introuvable', { status: 404 })

  try {
    const data = await readPhoto(attachment.storedName)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': attachment.mimeType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
      },
    })
  } catch {
    return new NextResponse('Introuvable', { status: 404 })
  }
}
