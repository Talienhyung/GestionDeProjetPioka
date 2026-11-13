'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { Phase } from '@/lib/domain/types'
import {
  archiveProject,
  createProject,
  deleteProject,
  launchProject,
  setPhase,
  setProjectCover,
} from '@/lib/services/projectService'
import { deletePhoto, fichierDuFormulaire, storeImage } from '@/lib/storage'

function rafraichir(projectId: string) {
  revalidatePath('/pilotage')
  revalidatePath('/cap', 'layout')
  revalidatePath(`/cap/${projectId}`)
}

export async function setPhaseAction(projectId: string, phase: Phase): Promise<FormState> {
  const chef = await requireChef()
  try {
    await setPhase(db, chef, projectId, phase)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir(projectId)
  return { success: 'Étape mise à jour.' }
}

/** Un brouillon devient visible de toute la caravane. */
export async function launchAction(projectId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    await launchProject(db, chef, projectId)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir(projectId)
  return { success: 'CAP lancé : les jeunes viennent d’être prévenus.' }
}

export async function archiveAction(projectId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    await archiveProject(db, chef, projectId)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir(projectId)
  return { success: 'CAP archivé. Il reste consultable, mais plus modifiable.' }
}

/** Crée un brouillon, avec sa couverture. Les autres CAP continuent leur vie. */
export async function newProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  let coverName: string | null = null
  try {
    const fichier = await fichierDuFormulaire(formData, 'cover')
    if (fichier) coverName = (await storeImage(fichier.buffer, fichier.nom, 'couverture')).storedName
    await createProject(db, chef, {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      coverName,
    })
  } catch (error) {
    if (coverName) await deletePhoto(coverName).catch(() => undefined)
    return toFormError(error)
  }
  revalidatePath('/pilotage')
  revalidatePath('/cap', 'layout')
  return { success: 'Brouillon créé. Garnis-le, puis lance-le quand tu veux.' }
}

/** Change ou retire la couverture d'un CAP. */
export async function coverAction(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  let nouvelle: string | null = null
  try {
    if (formData.get('retirer') !== '1') {
      const fichier = await fichierDuFormulaire(formData, 'cover')
      if (!fichier) return { error: 'Choisis une image.' }
      nouvelle = (await storeImage(fichier.buffer, fichier.nom, 'couverture')).storedName
    }
    const ancienne = await setProjectCover(db, chef, projectId, nouvelle)
    if (ancienne) await deletePhoto(ancienne).catch(() => undefined)
  } catch (error) {
    if (nouvelle) await deletePhoto(nouvelle).catch(() => undefined)
    return toFormError(error)
  }
  rafraichir(projectId)
  return { success: nouvelle ? 'Couverture enregistrée.' : 'Couverture retirée.' }
}

/** Supprime un CAP et tout ce qu'il contient, images comprises. */
export async function deleteAction(projectId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    const fichiers = await deleteProject(db, chef, projectId)
    // La base d'abord : si un fichier résiste, il n'est plus référencé nulle part.
    await Promise.all(fichiers.map((nom) => deletePhoto(nom).catch(() => undefined)))
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/pilotage')
  revalidatePath('/cap', 'layout')
  redirect('/pilotage')
}
