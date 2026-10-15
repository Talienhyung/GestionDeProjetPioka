'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, SESSION_TTL_MS, createSession, destroySession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { authenticate } from '@/lib/services/userService'

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  let mustChangePassword = false
  try {
    const user = await authenticate(db, username, password)
    const { token } = await createSession(db, user.id)
    mustChangePassword = user.mustChangePassword
    ;(await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
  } catch (error) {
    return toFormError(error)
  }

  redirect(mustChangePassword ? '/profil/mot-de-passe' : '/accueil')
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) await destroySession(db, token)
  store.delete(SESSION_COOKIE)
  redirect('/login')
}
