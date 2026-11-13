import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { bandesConnexionPdf } from '@/lib/pdf/bandesConnexion'

describe('bandes de connexion', () => {
  it('met huit bandes par page', async () => {
    const bandes = Array.from({ length: 11 }, (_, i) => ({
      displayName: `Jeune n°${i} Élodie`,
      username: `jeune${i}`,
      tempPassword: 'abcd2345efgh',
    }))
    const octets = await bandesConnexionPdf(bandes, 'https://cap.exemple.fr')
    const pdf = await PDFDocument.load(octets)
    expect(pdf.getPageCount()).toBe(2)
  })
})
