import { describe, expect, it } from 'vitest'
import { celluleCsv, nomFichierExport, versCsv } from '@/lib/domain/exportCsv'

describe('export CSV', () => {
  it('nomme le fichier à l’heure de Paris', () => {
    // 14 h 05 UTC en novembre = 15 h 05 à Paris.
    expect(nomFichierExport(new Date('2026-11-13T14:05:00Z'))).toBe('cap-gestion-13-11-26-1505.csv')
    // Juste après minuit à Paris (heure d'été), encore la veille en UTC.
    expect(nomFichierExport(new Date('2026-07-01T22:30:00Z'))).toBe('cap-gestion-02-07-26-0030.csv')
  })

  it('échappe les cellules et neutralise les formules', () => {
    expect(celluleCsv(null)).toBe('')
    expect(celluleCsv('simple')).toBe('simple')
    expect(celluleCsv('a;b')).toBe('"a;b"')
    expect(celluleCsv('il a dit "oui"')).toBe('"il a dit ""oui"""')
    expect(celluleCsv('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"')
    expect(celluleCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(celluleCsv(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z')
    expect(celluleCsv(true)).toBe('true')
  })

  it('assemble une section par table', () => {
    const csv = versCsv([
      { nom: 'User', colonnes: ['id', 'nom'], lignes: [{ id: '1', nom: 'Léa' }] },
      { nom: 'Note', colonnes: ['id'], lignes: [] },
    ])
    expect(csv).toBe('\uFEFF# User (1)\r\nid;nom\r\n1;Léa\r\n\r\n# Note (0)\r\nid\r\n')
  })
})
