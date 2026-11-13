'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { type BadgeInput, createBadge, deleteBadge, updateBadge } from '@/lib/services/badgeAdminService'
import { deletePhoto, fichierDuFormulaire, storeImage } from '@/lib/storage'

function lire(formData: FormData): BadgeInput {
  const nombre = (champ: string) => Number(formData.get(champ) ?? NaN)
  const mode = String(formData.get('mode') ?? 'picto')
  return {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    ruleType: String(formData.get('ruleType') ?? ''),
    threshold: nombre('threshold'),
    points: nombre('points'),
    sortOrder: nombre('sortOrder'),
    level: nombre('level'),
    color: String(formData.get('color') ?? ''),
    pictoKey: String(formData.get('pictoKey') ?? '') || null,
    // En mode picto, l'image éventuelle est retirée.
    removeImage: mode === 'picto',
  }
}

function rafraichir() {
  revalidatePath('/badges')
  revalidatePath('/parametres')
  revalidatePath('/profil')
}

/** Crée (badgeId null) ou modifie un badge, image comprise. */
export async function saveBadgeAction(badgeId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireSuperAdmin()
  const input = lire(formData)
  let nouvelle: string | null = null

  try {
    const fichier = String(formData.get('mode')) === 'image' ? await fichierDuFormulaire(formData, 'image') : null
    if (fichier) {
      nouvelle = (await storeImage(fichier.buffer, fichier.nom, 'badge')).storedName
      input.imageName = nouvelle
      input.removeImage = false
    }

    if (badgeId) {
      const { obsoleteImage } = await updateBadge(db, admin, badgeId, input)
      if (obsoleteImage) await deletePhoto(obsoleteImage)
    } else {
      await createBadge(db, admin, input)
    }
  } catch (error) {
    // L'image envoyée n'a servi à rien : on ne la laisse pas traîner dans le bucket.
    if (nouvelle) await deletePhoto(nouvelle).catch(() => undefined)
    return toFormError(error)
  }

  rafraichir()
  redirect('/badges')
}

export async function deleteBadgeAction(badgeId: string): Promise<FormState> {
  const admin = await requireSuperAdmin()
  try {
    const { obsoleteImage } = await deleteBadge(db, admin, badgeId)
    if (obsoleteImage) await deletePhoto(obsoleteImage).catch(() => undefined)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir()
  redirect('/badges')
}
