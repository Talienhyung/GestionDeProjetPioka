// src/lib/pdf/bandesConnexion.ts
/**
 * Bandes de connexion à imprimer puis découper : une par jeune, avec son nom,
 * son identifiant, son mot de passe provisoire et un QR code vers le site.
 * A4, huit bandes par page, traits de coupe en pointillés.
 */
import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export interface BandeConnexion {
  displayName: string
  username: string
  tempPassword: string
}

const MM = 72 / 25.4
const PAGE = { l: 210 * MM, h: 297 * MM }
const MARGE = 12 * MM
const PAR_PAGE = 8
const H_BANDE = (PAGE.h - 2 * MARGE) / PAR_PAGE

// Couleurs de la charte SGDF.
const BLEU = rgb(0, 0.38, 0.59)
const ORANGE = rgb(1, 0.53, 0.13)
const ENCRE = rgb(0.13, 0.15, 0.2)
const GRIS = rgb(0.45, 0.48, 0.53)
const TRAIT = rgb(0.75, 0.77, 0.8)

/** Le QR code, dessiné en carrés vectoriels : net à toutes les tailles d'impression. */
function dessinerQr(page: PDFPage, texte: string, x: number, y: number, cote: number) {
  const qr = QRCode.create(texte, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const m = cote / n
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!qr.modules.get(r, c)) continue
      // Un soupçon de chevauchement évite les filets blancs entre modules.
      page.drawRectangle({ x: x + c * m, y: y + cote - (r + 1) * m, width: m + 0.15, height: m + 0.15, color: ENCRE })
    }
  }
}

/** Coupe un texte trop long pour sa place, avec une ellipse. */
function ajuster(texte: string, police: PDFFont, taille: number, largeur: number): string {
  if (police.widthOfTextAtSize(texte, taille) <= largeur) return texte
  let t = texte
  while (t.length > 1 && police.widthOfTextAtSize(`${t}…`, taille) > largeur) t = t.slice(0, -1)
  return `${t}…`
}

function pointilles(page: PDFPage, y: number) {
  page.drawLine({
    start: { x: MARGE - 6 * MM, y },
    end: { x: PAGE.l - MARGE + 6 * MM, y },
    thickness: 0.6,
    color: TRAIT,
    dashArray: [4, 3],
  })
  page.drawText('coupe', { x: PAGE.l - MARGE + 1 * MM, y: y + 1.5, size: 5, color: TRAIT })
}

export async function bandesConnexionPdf(bandes: BandeConnexion[], urlSite: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Notre CAP : codes de connexion')
  pdf.setCreator('Notre CAP')
  const titre = await pdf.embedFont(StandardFonts.HelveticaBold)
  const texte = await pdf.embedFont(StandardFonts.Helvetica)
  const mono = await pdf.embedFont(StandardFonts.CourierBold)

  const urlLisible = urlSite.replace(/^https?:\/\//, '').replace(/\/$/, '')

  for (let i = 0; i < bandes.length; i += PAR_PAGE) {
    const page = pdf.addPage([PAGE.l, PAGE.h])
    const lot = bandes.slice(i, i + PAR_PAGE)
    pointilles(page, PAGE.h - MARGE)

    lot.forEach((b, k) => {
      const haut = PAGE.h - MARGE - k * H_BANDE
      const bas = haut - H_BANDE
      const pad = 4 * MM
      const cote = H_BANDE - 2 * pad
      const xQr = PAGE.l - MARGE - cote

      // Liseré orange à gauche : le repère de la caravane.
      page.drawRectangle({ x: MARGE, y: bas + pad, width: 1.6 * MM, height: H_BANDE - 2 * pad, color: ORANGE })

      const x = MARGE + 5 * MM
      const largeurTexte = xQr - x - 4 * MM
      page.drawText('NOTRE CAP · CONNEXION', { x, y: haut - pad - 7, size: 7, font: titre, color: BLEU })
      page.drawText(ajuster(b.displayName, titre, 15, largeurTexte), {
        x,
        y: haut - pad - 23,
        size: 15,
        font: titre,
        color: ENCRE,
      })

      const yChamps = haut - pad - 42
      const col2 = x + Math.min(62 * MM, largeurTexte / 2)
      page.drawText('IDENTIFIANT', { x, y: yChamps, size: 6.5, font: titre, color: GRIS })
      page.drawText(ajuster(b.username, mono, 13, col2 - x - 3 * MM), { x, y: yChamps - 14, size: 13, font: mono, color: ENCRE })
      page.drawText('MOT DE PASSE PROVISOIRE', { x: col2, y: yChamps, size: 6.5, font: titre, color: GRIS })
      page.drawText(b.tempPassword, { x: col2, y: yChamps - 14, size: 13, font: mono, color: ENCRE })

      page.drawText(
        ajuster(`Scanne le code ou va sur ${urlLisible}, puis choisis ton propre mot de passe.`, texte, 7.5, largeurTexte),
        { x, y: bas + pad + 1, size: 7.5, font: texte, color: GRIS },
      )

      dessinerQr(page, `${urlSite.replace(/\/$/, '')}/login?identifiant=${encodeURIComponent(b.username)}`, xQr, bas + pad, cote)
      pointilles(page, bas)
    })
  }
  return pdf.save()
}
