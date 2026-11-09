/** « Bonsoir » à partir de 18 h et jusqu'au petit matin, à l'heure française. */
export function salutation(now = new Date()): 'Bonjour,' | 'Bonsoir,' {
  const heure = Number(
    new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(now),
  )
  return heure >= 18 || heure < 5 ? 'Bonsoir,' : 'Bonjour,'
}
