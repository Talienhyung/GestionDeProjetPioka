// src/app/(app)/roles/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef, requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { NotFoundError } from '@/lib/services/errors'
import { getVisibleProject } from '@/lib/services/projectService'
import { applyToRole, closeRole, createRole, decideApplication } from '@/lib/services/roleService'

export async function applyAction(projectId: string, projectRoleId: string): Promise<FormState> {
  const user = await requireUser()
  try {
    await applyToRole(db, user, projectRoleId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath(`/cap/${projectId}/roles`)
  return { success: 'Candidature envoyée aux chefs.' }
}

export async function decideApplicationAction(
  projectId: string,
  projectRoleId: string,
  userId: string,
  accept: boolean,
): Promise<FormState> {
  const chef = await requireChef()
  try {
    await decideApplication(db, chef, { projectRoleId, userId, accept })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath(`/cap/${projectId}/roles`)
  return { success: accept ? 'Rôle attribué.' : 'Candidature écartée.' }
}

export async function closeRoleAction(projectId: string, projectRoleId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    const result = await closeRole(db, chef, projectRoleId)
    revalidatePath(`/cap/${projectId}/roles`)
    return { success: `Rôle clôturé : ${result.awarded} points versés.` }
  } catch (error) {
    return toFormError(error)
  }
}

export async function createRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  const projectId = String(formData.get('projectId') ?? '')
  try {
    const project = await getVisibleProject(db, chef, projectId)

    await createRole(db, chef, {
      projectId: project.id,
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      points: Number(formData.get('points') ?? 0),
    })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath(`/cap/${projectId}/roles`)
  return { success: 'Rôle créé.' }
}
