import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

/*
 * Typographies de la charte Scouts et Guides de France, hébergées avec le
 * site (sous-ensemble latin, licence SIL OFL) : pas d'appel à Google Fonts au
 * build ni à l'affichage.
 */

/** Titrage : au pinceau. */
const caveatBrush = localFont({
  src: './fonts/caveat-brush.woff2',
  variable: '--font-caveat-brush',
  weight: '400',
  display: 'swap',
})

/** Sous-titres, étiquettes et exergues (police variable). */
const raleway = localFont({
  src: './fonts/raleway.woff2',
  variable: '--font-raleway',
  weight: '500 800',
  display: 'swap',
})

/** Texte courant. */
const sarabun = localFont({
  src: [
    { path: './fonts/sarabun-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/sarabun-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sarabun',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Notre CAP',
  description: 'Le projet de la caravane Pionniers-Caravelles : tâches, rôles, points et badges.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    /* Les variables de police vont sur <html> : les jetons de :root s'en servent. */
    <html lang="fr" className={`${caveatBrush.variable} ${raleway.variable} ${sarabun.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
