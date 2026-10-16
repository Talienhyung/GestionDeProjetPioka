export type NomIcone =
  | 'maison'
  | 'boussole'
  | 'ecusson'
  | 'trophee'
  | 'coche'
  | 'personne'
  | 'groupe'
  | 'cloche'
  | 'chevron'
  | 'fanion'
  | 'reglages'

const TRACES: Record<NomIcone, string> = {
  maison: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M9.75 19.5v-5.75h4.5v5.75',
  boussole: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m3.5 5.5-2 5.5-5.5 2 2-5.5z',
  ecusson: 'M12 3.25 19 6v6c0 4-3 7-7 8.75C8 19 5 16 5 12V6zM9.5 12l1.75 1.75L15 10',
  trophee: 'M7 4h10v5a5 5 0 0 1-10 0zM7 5.5H4.5V7A3.5 3.5 0 0 0 7 10.3M17 5.5h2.5V7A3.5 3.5 0 0 1 17 10.3M12 14v3.5M8.5 20.5h7M9.5 17.5h5',
  coche: 'M4 12.5 9.5 18 20 6',
  personne: 'M12 4a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 4M4.75 20.5a7.25 7.25 0 0 1 14.5 0',
  groupe: 'M9 5a3.25 3.25 0 1 0 0 6.5A3.25 3.25 0 0 0 9 5M3 20a6 6 0 0 1 12 0M16 6.1a3.25 3.25 0 0 1 0 6.3M17.5 14.6a6 6 0 0 1 3.5 5.4',
  cloche: 'M12 3.5a5.5 5.5 0 0 1 5.5 5.5c0 4 1.5 5.5 2 6.5H4.5c.5-1 2-2.5 2-6.5A5.5 5.5 0 0 1 12 3.5M9.75 19a2.25 2.25 0 0 0 4.5 0',
  chevron: 'm9 5 7 7-7 7',
  fanion: 'M6 21V4m0 0 9 2.5L6 11',
  reglages: 'M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5M12 2.75v2.5m0 13.5v2.5M21.25 12h-2.5m-13.5 0h-2.5M18.5 5.5l-1.75 1.75M7.25 16.75 5.5 18.5m13 0-1.75-1.75M7.25 7.25 5.5 5.5',
}

interface Props {
  nom: NomIcone
  className?: string
  /** Taille en pixels ; 22 convient à la barre de navigation. */
  taille?: number
}

/** Icônes dessinées plutôt qu'emojis : à petite taille, les emojis tombent en carrés selon la police système. */
export function Icone({ nom, className = '', taille = 22 }: Props) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={TRACES[nom]} />
    </svg>
  )
}
