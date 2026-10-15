'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { markAllRead } from '@/lib/services/notificationService'

export async function markAllReadAction(): Promise<FormState> {
  const user = await requireUser()
  try {
    await markAllRead(db, user.id)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/notifications')
  revalidatePath('/accueil')
  return { success: 'Tout est lu.' }
}
