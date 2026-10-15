// src/app/(admin)/comptes/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { AppRole } from '@/lib/domain/types'
import { createUser, setActive } from '@/lib/services/userService'

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireSuperAdmin()
  try {
    const { user, tempPassword } = await createUser(db, admin, {
      username: String(formData.get('username') ?? ''),
      displayName: String(formData.get('displayName') ?? ''),
      role: String(formData.get('role') ?? 'JEUNE') as AppRole,
    })
    revalidatePath('/comptes')
    // Le mot de passe provisoire n'est affiché qu'ici, une seule fois.
    return { success: `Compte « ${user.username} » créé. Mot de passe provisoire : ${tempPassword}` }
  } catch (error) {
    return toFormError(error)
  }
}

export async function setActiveAction(userId: string, active: boolean): Promise<FormState> {
  const admin = await requireSuperAdmin()
  try {
    await setActive(db, admin, userId, active)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/comptes')
  return { success: active ? 'Compte réactivé.' : 'Compte désactivé.' }
}
