// src/app/(chef)/membres/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { resetPassword } from '@/lib/services/userService'

export async function resetPasswordAction(userId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    const tempPassword = await resetPassword(db, chef, userId)
    revalidatePath('/membres')
    return { success: `Nouveau mot de passe provisoire : ${tempPassword} — note-le, il ne sera plus affiché.` }
  } catch (error) {
    return toFormError(error)
  }
}
