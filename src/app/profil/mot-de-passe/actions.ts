// src/app/profil/mot-de-passe/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { changeOwnPassword } from '@/lib/services/userService'

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true })
  const current = String(formData.get('current') ?? '')
  const next = String(formData.get('next') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (next !== confirm) return { error: 'Les deux nouveaux mots de passe ne sont pas identiques.' }

  try {
    await changeOwnPassword(db, user, current, next)
  } catch (error) {
    return toFormError(error)
  }

  redirect('/accueil')
}
