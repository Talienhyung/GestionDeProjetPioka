/** « 5,50 » ou « 5.5 » → 550 centimes. Null si la saisie n'est pas un montant positif valide. */
export function parseEuros(saisie: string): number | null {
  const texte = saisie.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null
  return Math.round(Number(texte) * 100)
}

const FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export function formatEuros(cents: number): string {
  return FORMAT.format(cents / 100)
}
