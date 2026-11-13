'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { createNote, deleteNote, setPinned, updateNote } from '@/lib/services/noteService'
import { deletePhoto, fichierDuFormulaire, storeImage } from '@/lib/storage'

/** Le tableau de la caravane n'a pas de projet : le champ arrive vide. */
function lireProjet(formData: FormData): string | null {
  const brut = String(formData.get('projectId') ?? '')
  return brut === '' ? null : brut
}

function rafraichir(projectId: string | null) {
  revalidatePath(projectId === null ? '/tableau' : `/cap/${projectId}/billets`)
  revalidatePath('/accueil')
}

export async function createNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  const projectId = lireProjet(formData)
  const photo = formData.get('genre') === 'photo'
  let imageName: string | null = null

  try {
    if (photo) {
      const fichier = await fichierDuFormulaire(formData, 'image')
      if (!fichier) return { error: 'Choisis une photo à épingler.' }
      imageName = (await storeImage(fichier.buffer, fichier.nom, 'polaroid')).storedName
    }
    await createNote(db, user, {
      projectId,
      title: String(formData.get('title') ?? ''),
      body: String(formData.get('body') ?? ''),
      imageName,
    })
  } catch (error) {
    if (imageName) await deletePhoto(imageName).catch(() => undefined)
    return toFormError(error)
  }

  rafraichir(projectId)
  return { success: photo ? 'Photo épinglée au tableau.' : 'Billet épinglé au tableau.' }
}

export async function updateNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  const projectId = lireProjet(formData)

  try {
    await updateNote(db, user, String(formData.get('noteId') ?? ''), {
      title: String(formData.get('title') ?? ''),
      body: String(formData.get('body') ?? ''),
    })
  } catch (error) {
    return toFormError(error)
  }

  rafraichir(projectId)
  return { success: 'Billet modifié.' }
}

export async function deleteNoteAction(noteId: string, projectId: string | null): Promise<FormState> {
  const user = await requireUser()
  try {
    const photo = await deleteNote(db, user, noteId)
    if (photo) await deletePhoto(photo).catch(() => undefined)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir(projectId)
  return { success: 'Billet retiré.' }
}

export async function pinNoteAction(
  noteId: string,
  projectId: string | null,
  pinned: boolean,
): Promise<FormState> {
  const user = await requireUser()
  try {
    await setPinned(db, user, noteId, pinned)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir(projectId)
  return { success: pinned ? 'Billet épinglé en tête.' : 'Billet dépinglé.' }
}
