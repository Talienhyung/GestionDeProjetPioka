// src/components/Tampon.tsx
import { type CSSProperties, type ReactNode, useId } from 'react'
import { PictoMasque } from '@/components/sgdf/PictoMasque'

export type FormeTampon = 'rond' | 'rectangle' | 'octogone' | 'ticket' | 'etoile'

interface Props {
  forme: FormeTampon
  /** Couleur de l'encre. */
  encre: string
  picto: string
  /** Texte en couronne (formes rondes) ou en bandeau (autres formes). */
  haut: string
  bas: string
  taille: number
  /** Inclinaison, en degrés : un tampon n'est jamais posé tout droit. */
  angle: number
  /** Graine du grain de l'encre : chaque tampon a ses propres manques. */
  graine: number
  /** Contour en pointillés : tampon pas encore posé (à venir). */
  pointille?: boolean
  children?: ReactNode
}

/**
 * Un coup de tampon, comme sur un passeport : formes à double filet, texte
 * en couronne, picto au centre, encre légèrement usée (bruit SVG appliqué
 * en filtre à tout le tampon, picto compris).
 */
export function Tampon({ forme, encre, picto, haut, bas, taille, angle, graine, pointille = false }: Props) {
  const id = useId().replace(/:/g, '')
  const filtre = `encre-${id}`
  const arcHaut = `haut-${id}`
  const arcBas = `bas-${id}`
  const trait = { fill: 'none', stroke: encre, strokeDasharray: pointille ? '3 5' : undefined }
  const texte = {
    fill: encre,
    fontFamily: 'var(--font-raleway), sans-serif',
    fontWeight: 800,
    letterSpacing: '0.18em',
  } as const

  let forme_: ReactNode
  let textes: ReactNode
  let tailleTexte = 13

  switch (forme) {
    case 'rond':
    case 'etoile': {
      forme_ =
        forme === 'rond' ? (
          <>
            <circle cx="100" cy="100" r="92" {...trait} strokeWidth="6" />
            <circle cx="100" cy="100" r="80" {...trait} strokeWidth="2" />
            <circle cx="100" cy="100" r="54" {...trait} strokeWidth="2.5" />
          </>
        ) : (
          <>
            <polygon points={etoile(100, 100, 96, 84, 24)} {...trait} strokeWidth="4" strokeLinejoin="round" />
            <circle cx="100" cy="100" r="72" {...trait} strokeWidth="2" />
            <circle cx="100" cy="100" r="50" {...trait} strokeWidth="2.5" />
          </>
        )
      const r = forme === 'rond' ? 66 : 60
      tailleTexte = forme === 'rond' ? 15 : 13
      textes = (
        <>
          <defs>
            <path id={arcHaut} d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`} />
            <path id={arcBas} d={`M ${100 - r - 11} 100 A ${r + 11} ${r + 11} 0 0 0 ${100 + r + 11} 100`} />
          </defs>
          <text {...texte} fontSize={tailleTexte} textAnchor="middle">
            <textPath href={`#${arcHaut}`} startOffset="50%">
              {haut}
            </textPath>
          </text>
          <text {...texte} fontSize={tailleTexte - 2} textAnchor="middle">
            <textPath href={`#${arcBas}`} startOffset="50%">
              {bas}
            </textPath>
          </text>
          {/* Deux étoiles entre les deux couronnes, comme sur les vrais tampons. */}
          <text {...texte} fontSize="14" x="24" y="105" textAnchor="middle" letterSpacing="0">
            ★
          </text>
          <text {...texte} fontSize="14" x="176" y="105" textAnchor="middle" letterSpacing="0">
            ★
          </text>
        </>
      )
      break
    }
    case 'rectangle':
    case 'ticket':
    case 'octogone': {
      forme_ =
        forme === 'rectangle' ? (
          <>
            <rect x="10" y="34" width="180" height="132" rx="10" {...trait} strokeWidth="6" />
            <rect x="20" y="44" width="160" height="112" rx="5" {...trait} strokeWidth="2" />
          </>
        ) : forme === 'ticket' ? (
          <>
            <path d={ticket(10, 34, 180, 132, 13)} {...trait} strokeWidth="5" />
            <path d={ticket(20, 44, 160, 112, 9)} {...trait} strokeWidth="2" />
          </>
        ) : (
          <>
            <polygon points={octogone(100, 100, 94)} {...trait} strokeWidth="6" strokeLinejoin="round" />
            <polygon points={octogone(100, 100, 82)} {...trait} strokeWidth="2" strokeLinejoin="round" />
          </>
        )
      // Le bandeau s'adapte à la longueur du texte : rien ne déborde du cadre.
      const taillePlate = Math.min(15, 140 / (haut.length * 0.9))
      const yHaut = forme === 'octogone' ? 62 : 72
      const yBas = forme === 'octogone' ? 150 : 141
      textes = (
        <>
          <text {...texte} fontSize={taillePlate} x="100" y={yHaut} textAnchor="middle">
            {haut}
          </text>
          <line x1="48" x2="152" y1={yHaut + 9} y2={yHaut + 9} stroke={encre} strokeWidth="1.5" />
          <line x1="48" x2="152" y1={yBas - 17} y2={yBas - 17} stroke={encre} strokeWidth="1.5" />
          <text {...texte} fontSize="12" x="100" y={yBas} textAnchor="middle">
            {bas}
          </text>
        </>
      )
      break
    }
  }

  const style = { width: taille, height: taille, rotate: `${angle}deg`, filter: `url(#${filtre})` } as CSSProperties

  return (
    <div className="relative shrink-0" style={style}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          {/* L'encre : des manques là où le tampon a moins appuyé, des bords un peu baveux. */}
          <filter id={filtre} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={graine} result="grain" />
            <feColorMatrix
              in="grain"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.7 0 0 0 1.6"
              result="manques"
            />
            <feComposite in="SourceGraphic" in2="manques" operator="in" result="use" />
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed={graine + 7} result="ondes" />
            <feDisplacementMap in="use" in2="ondes" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        {forme_}
        {textes}
      </svg>
      <span className="absolute inset-0 grid place-items-center" style={{ color: encre }}>
        <PictoMasque cle={picto} taille={Math.round(taille * (forme === 'rond' || forme === 'etoile' ? 0.3 : 0.22))} />
      </span>
    </div>
  )
}

function etoile(cx: number, cy: number, rExt: number, rInt: number, branches: number): string {
  const pts: string[] = []
  for (let i = 0; i < branches * 2; i++) {
    const a = (Math.PI * i) / branches - Math.PI / 2
    const r = i % 2 === 0 ? rExt : rInt
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

function octogone(cx: number, cy: number, r: number): string {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i + Math.PI / 8
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

/** Rectangle aux coins entaillés, comme un ticket. */
function ticket(x: number, y: number, w: number, h: number, e: number): string {
  return [
    `M ${x + e} ${y}`,
    `H ${x + w - e}`,
    `A ${e} ${e} 0 0 0 ${x + w} ${y + e}`,
    `V ${y + h - e}`,
    `A ${e} ${e} 0 0 0 ${x + w - e} ${y + h}`,
    `H ${x + e}`,
    `A ${e} ${e} 0 0 0 ${x} ${y + h - e}`,
    `V ${y + e}`,
    `A ${e} ${e} 0 0 0 ${x + e} ${y}`,
    'Z',
  ].join(' ')
}
