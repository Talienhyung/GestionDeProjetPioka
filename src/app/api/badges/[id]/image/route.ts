// src/app/api/badges/[id]/image/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { readPhoto } from '@/lib/storage'

/** Image d'un écusson : réservée aux membres connectés, comme toutes les images du site. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Non autorisé', { status: 401 })

  const { id } = await params
  const badge = await db.badge.findUnique({ where: { id }, select: { imageName: true } })
  const name = badge?.imageName
  if (!name) return new NextResponse('Introuvable', { status: 404 })

  try {
    const data = await readPhoto(name)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/webp',
        // L'adresse change avec l'image (?v=…) : on peut garder longtemps.
        'Cache-Control': 'private, max-age=604800, immutable',
      },
    })
  } catch {
    return new NextResponse('Introuvable', { status: 404 })
  }
}
