// src/app/(app)/cap/[taskId]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef, requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { cancelValidation, submitTask } from '@/lib/services/submissionService'
import { joinTask, leaveTask, removeParticipant } from '@/lib/services/taskService'

export async function joinAction(taskId: string): Promise<FormState> {
  const user = await requireUser()
  try {
    await joinTask(db, user, taskId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap', 'layout')
  return { success: 'Tu es inscrit sur cette tâche.' }
}

export async function leaveAction(taskId: string): Promise<FormState> {
  const user = await requireUser()
  try {
    await leaveTask(db, user, taskId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap', 'layout')
  return { success: 'Tu t\'es retiré de cette tâche.' }
}

export async function submitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  const taskId = String(formData.get('taskId') ?? '')
  const message = String(formData.get('message') ?? '')

  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  const photos = await Promise.all(
    files.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
    })),
  )

  try {
    await submitTask(db, user, { taskId, message, photos })
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/cap', 'layout')
  return { success: 'C\'est envoyé ! Un chef va regarder ça.' }
}

/** Un chef retire un participant : le seul recours une fois le travail rendu. */
export async function removeParticipantAction(taskId: string, userId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    await removeParticipant(db, chef, taskId, userId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap', 'layout')
  return { success: 'Participant retiré de la tâche.' }
}

/** Un chef revient sur une validation : les points sont repris au grand livre. */
export async function cancelValidationAction(taskId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    await cancelValidation(db, chef, taskId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap', 'layout')
    return { success: 'Validation annulée, les points ont été repris.' }
}
