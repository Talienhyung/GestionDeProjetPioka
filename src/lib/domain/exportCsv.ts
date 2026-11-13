// src/lib/domain/exportCsv.ts
/**
 * Export de sauvegarde : toutes les données du site dans un seul CSV, une
 * section par table (« # Table », en-têtes, lignes, puis une ligne vide).
 * Lisible dans un tableur, et assez complet pour reconstruire la base.
 * Les secrets n'y figurent jamais : empreintes de mots de passe et sessions.
 */

/** Tables jamais exportées : des jetons de connexion, inutiles à restaurer. */
export const TABLES_EXCLUES = new Set(['Session'])

/** Champs jamais exportés, par table. */
export const CHAMPS_EXCLUS: Record<string, Set<string>> = {
  User: new Set(['passwordHash']),
}

/** Point-virgule : le séparateur qu'Excel attend en français. */
const SEP = ';'

export function celluleCsv(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  const texte = valeur instanceof Date ? valeur.toISOString() : String(valeur)
  // Une cellule commençant par = + - @ serait exécutée comme une formule par
  // le tableur : on la neutralise (injection CSV).
  const sur = /^[=+\-@\t\r]/.test(texte) ? `'${texte}` : texte
  return /[";\n\r,]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur
}

export interface TableExport {
  nom: string
  colonnes: string[]
  lignes: Record<string, unknown>[]
}

export function versCsv(tables: TableExport[]): string {
  const blocs = tables.map((t) => {
    const lignes = [`# ${t.nom} (${t.lignes.length})`, t.colonnes.map(celluleCsv).join(SEP)]
    for (const l of t.lignes) lignes.push(t.colonnes.map((c) => celluleCsv(l[c])).join(SEP))
    return lignes.join('\r\n')
  })
  // BOM : Excel lit alors les accents correctement.
  return '\uFEFF' + blocs.join('\r\n\r\n') + '\r\n'
}

/** « cap-gestion-JJ-MM-AA-HHMM.csv », à l'heure de Paris. */
export function nomFichierExport(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return `cap-gestion-${parts.day}-${parts.month}-${parts.year}-${parts.hour}${parts.minute}.csv`
}
