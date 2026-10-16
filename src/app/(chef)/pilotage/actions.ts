'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { Phase } from '@/lib/domain/types'
import { archiveProject, createProject, launchProject, setPhase } from '@/lib/services/projectService'

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

/** Crée un brouillon. Les autres CAP continuent leur vie. */
export async function newProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  try {
    await createProject(db, chef, {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
    })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/pilotage')
  revalidatePath('/cap', 'layout')
  return { success: 'Brouillon créé. Garnis-le, puis lance-le quand tu veux.' }
}
