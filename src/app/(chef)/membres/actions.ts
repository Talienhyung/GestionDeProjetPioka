// src/app/(chef)/membres/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { awardBadge, awardPoints, revokeBadge } from '@/lib/services/recompenseService'
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

function rafraichir(userId: string) {
  revalidatePath('/membres')
  revalidatePath(`/membres/${userId}`)
}

export async function awardBadgeAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  try {
    await awardBadge(db, chef, {
      userId,
      badgeId: String(formData.get('badgeId') ?? ''),
      reason: String(formData.get('reason') ?? ''),
      projectId: String(formData.get('projectId') ?? '') || null,
    })
  } catch (error) {
    return toFormError(error)
  }
  rafraichir(userId)
  return { success: 'Écusson remis. Le jeune a reçu une notification.' }
}

export async function awardPointsAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  try {
    const sens = formData.get('sens') === 'retirer' ? -1 : 1
    await awardPoints(db, chef, {
      userId,
      projectId: String(formData.get('projectId') ?? ''),
      amount: sens * Math.abs(Number(formData.get('amount') ?? 0)),
      reason: String(formData.get('reason') ?? ''),
    })
  } catch (error) {
    return toFormError(error)
  }
  rafraichir(userId)
  return { success: 'Points enregistrés. Le jeune a reçu une notification.' }
}

export async function revokeBadgeAction(userId: string, badgeId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    await revokeBadge(db, chef, userId, badgeId)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir(userId)
  return { success: 'Écusson retiré.' }
}
