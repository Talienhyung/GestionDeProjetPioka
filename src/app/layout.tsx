import type { Metadata } from 'next'
import { Atkinson_Hyperlegible, Barlow_Condensed } from 'next/font/google'
import './globals.css'

/** Typo de panneau : capitales serrées, lisibles de loin comme un balisage. */
const barlow = Barlow_Condensed({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
})

/** Texte courant : dessinée pour la lisibilité, utile sur un téléphone en plein soleil. */
const atkinson = Atkinson_Hyperlegible({
  variable: '--font-atkinson',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Notre CAP',
  description: 'Le projet de la caravane Pionniers-Caravelles : tâches, rôles, points et badges.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${barlow.variable} ${atkinson.variable} antialiased`}>{children}</body>
    </html>
  )
}
