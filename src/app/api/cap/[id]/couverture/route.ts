// src/app/api/cap/[id]/couverture/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { NotFoundError } from '@/lib/services/errors'
import { getVisibleProject } from '@/lib/services/projectService'
import { readPhoto } from '@/lib/storage'

/** Couverture d'un CAP. Celle d'un brouillon n'est visible que des chefs, comme le brouillon. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Non autorisé', { status: 401 })

  const { id } = await params
  let name: string | null = null
  try {
    name = (await getVisibleProject(db, user, id)).coverName
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error
  }
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
