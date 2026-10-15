export const MAX_LOGIN_ATTEMPTS = 10
export const LOGIN_WINDOW_MS = 15 * 60 * 1000

/**
 * Limitation en mémoire des tentatives de connexion.
 * L'application tourne dans un conteneur unique : un redémarrage remet les
 * compteurs à zéro, ce qui est acceptable pour une caravane.
 */
export class LoginThrottle {
  private failures = new Map<string, number[]>()

  constructor(
    private readonly maxAttempts = MAX_LOGIN_ATTEMPTS,
    private readonly windowMs = LOGIN_WINDOW_MS,
  ) {}

  private key(username: string): string {
    return username.trim().toLowerCase()
  }

  private recent(username: string, now: number): number[] {
    const all = this.failures.get(this.key(username)) ?? []
    return all.filter((at) => now - at < this.windowMs)
  }

  registerFailure(username: string, now: number = Date.now()): void {
    this.failures.set(this.key(username), [...this.recent(username, now), now])
  }

  isBlocked(username: string, now: number = Date.now()): boolean {
    return this.recent(username, now).length >= this.maxAttempts
  }

  reset(username: string): void {
    this.failures.delete(this.key(username))
  }
}

export const loginThrottle = new LoginThrottle()
