// src/app/(app)/cap/[taskId]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { submitTask } from '@/lib/services/submissionService'
import { joinTask, leaveTask } from '@/lib/services/taskService'

export async function joinAction(taskId: string): Promise<FormState> {
  const user = await requireUser()
  try {
    await joinTask(db, user, taskId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath(`/cap/${taskId}`)
  return { success: 'Tu es inscrit sur cette tâche.' }
}

export async function leaveAction(taskId: string): Promise<FormState> {
  const user = await requireUser()
  try {
    await leaveTask(db, user, taskId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath(`/cap/${taskId}`)
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

  revalidatePath(`/cap/${taskId}`)
  return { success: 'C\'est envoyé ! Un chef va regarder ça.' }
}
