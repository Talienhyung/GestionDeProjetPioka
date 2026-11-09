// src/app/(app)/agenda/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { parisDateTime } from '@/lib/domain/agenda'
import { type FormState, toFormError } from '@/lib/formState'
import { ValidationError } from '@/lib/services/errors'
import { createEvent, deleteEvent } from '@/lib/services/eventService'

export async function createEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireChef()
  const text = (key: string) => String(formData.get(key) ?? '').trim()

  try {
    const allDay = formData.get('allDay') === 'on'
    const startsAt = parisDateTime(text('startDate'), allDay ? '' : text('startTime'))
    if (!startsAt) throw new ValidationError('Choisis une date de début.')
    const endDate = text('endDate')
    const endsAt = endDate ? parisDateTime(endDate, allDay ? '23:59' : text('endTime') || text('startTime')) : null
    if (endDate && !endsAt) throw new ValidationError('La date de fin est invalide.')

    await createEvent(db, actor, {
      title: text('title'),
      description: text('description'),
      location: text('location'),
      startsAt,
      endsAt,
      allDay,
      audience: text('audience'),
      roleIds: formData.getAll('roleIds').map(String),
    })
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/agenda')
  revalidatePath('/accueil')
  return { success: 'Événement ajouté à l’agenda.' }
}

export async function deleteEventAction(eventId: string): Promise<FormState> {
  const actor = await requireChef()
  try {
    await deleteEvent(db, actor, eventId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/agenda')
  revalidatePath('/accueil')
  return { success: 'Événement retiré.' }
}
