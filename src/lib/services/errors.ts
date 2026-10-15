export class NotFoundError extends Error {
  constructor(quoi = 'Élément') {
    super(`${quoi} introuvable.`)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Action réservée aux chefs.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
