export interface FormState {
  error?: string
  success?: string
}

export const EMPTY_FORM_STATE: FormState = {}

/** Transforme une erreur de service en message affichable, sans fuite technique. */
export function toFormError(error: unknown): FormState {
  const known = ['AuthError', 'ValidationError', 'ForbiddenError', 'NotFoundError', 'UploadError',
    'TaskTransitionError', 'AlreadyReviewedError', 'WeakPasswordError', 'DuplicateAwardError']
  if (error instanceof Error && known.includes(error.name)) return { error: error.message }
  console.error(error)
  return { error: 'Une erreur est survenue. Réessaie, et préviens un chef si ça recommence.' }
}
