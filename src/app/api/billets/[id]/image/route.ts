// src/app/api/billets/[id]/image/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { NotFoundError } from '@/lib/services/errors'
import { noteImageFor } from '@/lib/services/noteService'
import { readPhoto } from '@/lib/storage'

/** Photo d'un billet polaroid, pour qui peut voir le tableau où il est épinglé. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Non autorisé', { status: 401 })

  const { id } = await params
  let name: string | null = null
  try {
    name = await noteImageFor(db, user, id)
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
