'use client'

import Link from 'next/link'
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type ApparenceBadge, Ecusson } from '@/components/Ecusson'
import { type FormeTampon, Tampon } from '@/components/Tampon'
import { NOMS_NIVEAUX, niveauRomain } from '@/lib/domain/badgeLook'
import type { GenreEtape } from '@/lib/domain/parcours'

/** Une étape, sérialisée pour le client (dates en ISO). */
export interface EtapeVue {
  cle: string
  genre: GenreEtape
  date: string
  titre: string
  detail: string | null
  points: number
  cumul: number
  lien: string | null
  badge?: ApparenceBadge
}

const TAMPON: Record<Exclude<GenreEtape, 'BADGE'>, { forme: FormeTampon; encre: string; picto: string; haut: string }> = {
  DEPART: { forme: 'rond', encre: 'var(--institution)', picto: 'tente', haut: 'DÉPART' },
  ACTIVITE: { forme: 'rond', encre: 'var(--institution)', picto: 'feu_de_camp', haut: 'ACTIVITÉ' },
  TACHE: { forme: 'rectangle', encre: 'var(--agir)', picto: 'coche', haut: 'VALIDÉ' },
  ROLE: { forme: 'octogone', encre: 'var(--partager-encre)', picto: 'promesse', haut: 'RÔLE TENU' },
  BOULOT: { forme: 'ticket', encre: 'var(--choisir-encre)', picto: 'euros', haut: 'PETIT BOULOT' },
  BONUS: { forme: 'etoile', encre: 'var(--accent)', picto: 'etincelle', haut: 'BONUS' },
  A_VENIR: { forme: 'rond', encre: 'var(--encre-douce)', picto: 'destination', haut: 'À VENIR' },
}

const LIBELLE: Record<GenreEtape, string> = {
  DEPART: 'Le départ',
  ACTIVITE: 'Activité',
  TACHE: 'Tâche validée',
  ROLE: 'Rôle tenu',
  BADGE: 'Badge gagné',
  BOULOT: 'Petit boulot',
  BONUS: 'Bonus',
  A_VENIR: 'Prochaine étape',
}

const MOIS = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC']

/** « 12 OCT 2026 », à l'heure de Paris : la date frappée dans le tampon. */
function dateTampon(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  )
  return `${p.day} ${MOIS[Number(p.month) - 1]} ${p.year}`
}

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })

function empreinte(texte: string): number {
  let h = 0
  for (const c of texte) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

/** Hauteur de la zone du tampon : le pointillé passe à mi-hauteur. */
const H_TAMPON = 164
/** Hauteur approximative d'une étape complète (tampon + texte) : sert à la centrer. */
const H_CONTENU = 320
/** Hauteur des ondulations du pointillé. */
const BOSSE = 22
/** Demi-largeur visible de chaque genre de tampon : le pointillé s'arrête à son bord. */
const RAYON: Record<GenreEtape, number> = {
  DEPART: 76,
  ACTIVITE: 76,
  TACHE: 76,
  ROLE: 72,
  BOULOT: 76,
  BONUS: 74,
  BADGE: 66,
  A_VENIR: 56,
}

/**
 * La route du jeune, à parcourir du doigt : un coup de tampon par étape, une
 * étape au centre, les voisines qui dépassent sur les côtés, le tout relié par
 * un pointillé orange qui ondule. Le défilement s'arrête à chaque étape.
 */
export function RouteParcours({ etapes, depart }: { etapes: EtapeVue[]; depart: number }) {
  const piste = useRef<HTMLOListElement>(null)
  const [courante, setCourante] = useState(depart)
  const [route, setRoute] = useState<{ d: string; largeur: number; y: number } | null>(null)

  const stations = (): HTMLElement[] => Array.from(piste.current?.querySelectorAll<HTMLElement>(':scope > .route-etape') ?? [])

  /** Une seule courbe, lisse, qui passe par le centre de chaque station en ondulant. */
  const tracer = useCallback(() => {
    const el = piste.current
    if (!el) return
    // L'étape se centre (un peu bas) dans la hauteur disponible.
    // Sur un grand écran, l'étape grandit un peu pour occuper la hauteur.
    const zoom = Math.min(1.25, Math.max(1, el.clientHeight / 520))
    el.style.setProperty('--zoom', String(zoom))
    // Un peu sous le centre : la barre du bas pèse visuellement plus que les pastilles du haut.
    const haut = Math.max(12, Math.round((el.clientHeight - H_CONTENU * zoom) / 2 + 44))
    el.style.setProperty('--haut-etape', `${haut}px`)
    const y = haut + H_TAMPON / 2
    const pts = stations().map((s) => ({
      x: s.offsetLeft + s.offsetWidth / 2,
      r: RAYON[(s.dataset.genre ?? 'ACTIVITE') as GenreEtape] * zoom,
    }))
    // Un tronçon entre chaque paire de tampons, du bord de l'un au bord de
    // l'autre : une vague douce (en haut puis en bas), qui part et arrive à plat.
    let d = ''
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1].x + pts[i - 1].r + 6
      const b = pts[i].x - pts[i].r - 6
      const l = b - a
      if (l < 24) continue
      d += ` M ${a} ${y} C ${a + l * 0.3} ${y - BOSSE * 2} ${b - l * 0.3} ${y + BOSSE * 2} ${b} ${y}`
    }
    setRoute({ d: d.trim(), largeur: el.scrollWidth, y })
  }, [])

  /** Met en avant l'étape du centre ; les autres rapetissent et pâlissent. */
  const peindre = useCallback(() => {
    const el = piste.current
    if (!el) return
    const centre = el.scrollLeft + el.clientWidth / 2
    let plusProche = 0
    let meilleure = Infinity
    stations().forEach((s, i) => {
      const d = (s.offsetLeft + s.offsetWidth / 2 - centre) / s.offsetWidth
      const a = Math.min(Math.abs(d), 1.2)
      s.style.setProperty('--echelle', String(1 - a * 0.14))
      s.style.setProperty('--opacite', String(1 - Math.min(a, 1) * 0.55))
      if (Math.abs(d) < meilleure) {
        meilleure = Math.abs(d)
        plusProche = i
      }
    })
    setCourante(plusProche)
  }, [])

  const aller = useCallback((i: number, doux = true) => {
    const el = piste.current
    const s = stations()[i]
    if (!el || !s) return
    el.scrollTo({
      left: s.offsetLeft + s.offsetWidth / 2 - el.clientWidth / 2,
      behavior: doux && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant',
    })
  }, [])

  // Ouvre directement sur la dernière étape vécue, sans animation.
  useLayoutEffect(() => {
    tracer()
    aller(depart, false)
    peindre()
  }, [aller, depart, peindre, tracer])

  useEffect(() => {
    const el = piste.current
    if (!el) return
    let image = 0
    const surDefilement = () => {
      cancelAnimationFrame(image)
      image = requestAnimationFrame(peindre)
    }
    const surTaille = () => {
      tracer()
      surDefilement()
    }
    el.addEventListener('scroll', surDefilement, { passive: true })
    window.addEventListener('resize', surTaille)
    // Les polices arrivent après le premier rendu et changent les largeurs.
    document.fonts?.ready.then(surTaille)
    return () => {
      el.removeEventListener('scroll', surDefilement)
      window.removeEventListener('resize', surTaille)
      cancelAnimationFrame(image)
    }
  }, [peindre, tracer])

  return (
    <ol
      ref={piste}
      tabIndex={0}
      aria-label="Ton parcours, étape par étape"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault()
          aller(Math.max(0, Math.min(etapes.length - 1, courante + (e.key === 'ArrowRight' ? 1 : -1))))
        }
      }}
      className="route-piste relative -mx-4 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain outline-none"
    >
      {route ? (
        <li aria-hidden className="pointer-events-none absolute top-0 left-0" style={{ width: route.largeur }}>
          <svg width={route.largeur} height={route.y + BOSSE * 3} className="block overflow-visible">
            <path
              d={route.d}
              fill="none"
              stroke="var(--choisir)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="0 9"
            />
          </svg>
        </li>
      ) : null}

      {etapes.map((etape, i) => (
        <Etape key={etape.cle} etape={etape} active={i === courante} />
      ))}
    </ol>
  )
}

function Etape({ etape, active }: { etape: EtapeVue; active: boolean }) {
  const avenir = etape.genre === 'A_VENIR'
  const h = empreinte(etape.cle)
  // Toujours un peu de travers, jamais tout droit : entre 2 et 8 degrés, d'un côté ou de l'autre.
  const angle = (h % 2 ? 1 : -1) * (2 + (h % 7)) * (avenir ? 0.5 : 1)

  return (
    <li
      className={`route-etape relative flex shrink-0 snap-center snap-always flex-col items-center ${avenir ? 'route-avenir' : ''}`}
      aria-current={active ? 'step' : undefined}
      data-genre={etape.genre}
    >
      <Link
        href={etape.lien ?? '#'}
        aria-disabled={!etape.lien}
        tabIndex={etape.lien && active ? undefined : -1}
        onClick={(e) => {
          if (!etape.lien || !active) e.preventDefault()
        }}
        className="route-carte flex min-h-0 w-full flex-1 flex-col items-center text-center"
        style={{ paddingTop: 'var(--haut-etape, 24px)' }}
      >
        {/* Le tampon, dans une zone de hauteur fixe : le pointillé passe à mi-hauteur. */}
        <div className="grid shrink-0 place-items-center" style={{ height: H_TAMPON }}>
          {etape.genre === 'BADGE' && etape.badge ? (
            <BadgeGagne badge={etape.badge} angle={angle} />
          ) : (
            <Tampon
              {...TAMPON[etape.genre as Exclude<GenreEtape, 'BADGE'>]}
              bas={dateTampon(etape.date)}
              taille={avenir ? 112 : 152}
              angle={angle}
              graine={h % 97}
              pointille={avenir}
            />
          )}
        </div>

        <p className="panneau mt-3 text-[10px] text-encre-douce">{LIBELLE[etape.genre]}</p>
        <h2 className={`brush mt-0.5 leading-[1.05] break-words ${avenir ? 'text-2xl text-encre-douce' : 'text-[2rem]'}`}>
          {etape.titre}
        </h2>
        {etape.detail ? (
          <p className="mt-1 line-clamp-2 max-w-[18rem] text-sm whitespace-pre-line text-encre-douce">{etape.detail}</p>
        ) : null}
        <p className="mt-1 text-xs text-encre-douce first-letter:uppercase">{dateLongue(etape.date)}</p>

        {etape.points !== 0 ? (
          <p className="mt-2 flex items-baseline gap-2">
            <span
              className={`brush inline-block -rotate-3 text-3xl leading-none tabular-nums ${
                etape.points > 0 ? 'text-choisir-encre' : 'text-erreur'
              }`}
            >
              {etape.points > 0 ? '+' : ''}
              {etape.points} pts
            </span>
            <span className="text-[11px] text-encre-douce tabular-nums">→ {etape.cumul} au total</span>
          </p>
        ) : null}
      </Link>
    </li>
  )
}

/** Un badge gagné : l'écusson posé sur un éclat de lumière, avec son ruban de niveau. */
function BadgeGagne({ badge, angle }: { badge: ApparenceBadge; angle: number }) {
  return (
    <div className="relative grid size-40 shrink-0 place-items-center">
      {/* Éclat : des rayons à la couleur du badge, qui tournent doucement. */}
      <span aria-hidden className="badge-eclat absolute inset-0" style={{ '--fond': badge.color } as CSSProperties} />
      {/* Confettis aux couleurs de la charte. */}
      {[
        ['6%', '16%', 'var(--choisir)', '20deg'],
        ['86%', '10%', 'var(--agir)', '-25deg'],
        ['94%', '50%', 'var(--partager)', '70deg'],
        ['90%', '78%', 'var(--accent)', '45deg'],
        ['0%', '48%', 'var(--agir)', '-60deg'],
        ['4%', '80%', 'var(--partager)', '-10deg'],
        ['46%', '-4%', 'var(--accent)', '8deg'],
        ['24%', '2%', 'var(--partager)', '-30deg'],
        ['72%', '0%', 'var(--choisir)', '35deg'],
        ['18%', '96%', 'var(--choisir)', '15deg'],
      ].map(([x, y, c, r]) => (
        <span
          key={x + y}
          aria-hidden
          className="absolute h-3 w-1.5 rounded-full"
          style={{ left: x, top: y, background: c, rotate: r }}
        />
      ))}
      <span className="relative" style={{ rotate: `${angle * 0.6}deg` }}>
        <Ecusson {...badge} taille={104} ruban={false} />
      </span>
      <span className="panneau absolute bottom-3 bg-accent px-4 py-1 text-[10px] whitespace-nowrap text-sur-accent shadow-md [clip-path:polygon(0_0,100%_0,93%_50%,100%_100%,0_100%,7%_50%)]">
        Niveau {niveauRomain(badge.level)} · {NOMS_NIVEAUX[badge.level]}
      </span>
    </div>
  )
}
