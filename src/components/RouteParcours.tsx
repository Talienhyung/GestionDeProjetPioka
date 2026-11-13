'use client'

import Link from 'next/link'
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type ApparenceBadge, Ecusson } from '@/components/Ecusson'
import { PictoMasque } from '@/components/sgdf/PictoMasque'
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

const STYLE: Record<GenreEtape, { label: string; picto: string; fond: string; encre: string; doux: string }> = {
  DEPART: { label: 'Le départ', picto: 'tente', fond: 'var(--institution)', encre: '#fff', doux: 'var(--surface-haute)' },
  ACTIVITE: { label: 'Activité', picto: 'feu_de_camp', fond: 'var(--institution)', encre: '#fff', doux: 'var(--surface-haute)' },
  TACHE: { label: 'Tâche validée', picto: 'coche', fond: 'var(--agir)', encre: '#fff', doux: 'var(--agir-doux)' },
  ROLE: { label: 'Rôle tenu', picto: 'promesse', fond: 'var(--partager)', encre: '#fff', doux: 'var(--partager-doux)' },
  BADGE: { label: 'Badge gagné', picto: 'coupe', fond: 'var(--accent)', encre: '#fff', doux: 'var(--accent-doux)' },
  BOULOT: { label: 'Petit boulot', picto: 'euros', fond: 'var(--choisir)', encre: 'var(--encre)', doux: 'var(--choisir-doux)' },
  BONUS: { label: 'Bonus', picto: 'etincelle', fond: 'var(--choisir)', encre: 'var(--encre)', doux: 'var(--choisir-doux)' },
  A_VENIR: { label: 'Prochaine étape', picto: 'destination', fond: 'var(--carte)', encre: 'var(--accent)', doux: 'var(--surface)' },
}

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
const annee = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', timeZone: 'Europe/Paris' })

/**
 * La route du jeune, à parcourir du doigt : une étape au centre, les voisines
 * qui dépassent sur les côtés, reliées par un pointillé orange qui ondule.
 * Le défilement s'arrête à chaque étape (scroll-snap), une à la fois.
 */
export function RouteParcours({ etapes, depart }: { etapes: EtapeVue[]; depart: number }) {
  const piste = useRef<HTMLOListElement>(null)
  const [courante, setCourante] = useState(depart)

  const cartes = () => Array.from(piste.current?.children ?? []) as HTMLElement[]

  /** Agrandit l'étape du centre, estompe les autres, selon leur distance. */
  const peindre = useCallback(() => {
    const el = piste.current
    if (!el) return
    const centre = el.scrollLeft + el.clientWidth / 2
    let plusProche = 0
    let meilleure = Infinity
    cartes().forEach((carte, i) => {
      const milieu = carte.offsetLeft + carte.offsetWidth / 2
      const d = (milieu - centre) / carte.offsetWidth
      const a = Math.min(Math.abs(d), 1.2)
      carte.style.setProperty('--echelle', String(1 - a * 0.1))
      carte.style.setProperty('--opacite', String(1 - Math.min(a, 1) * 0.5))
      if (Math.abs(d) < meilleure) {
        meilleure = Math.abs(d)
        plusProche = i
      }
    })
    setCourante(plusProche)
  }, [])

  const aller = useCallback((i: number, doux = true) => {
    const el = piste.current
    const carte = cartes()[i]
    if (!el || !carte) return
    el.scrollTo({
      left: carte.offsetLeft + carte.offsetWidth / 2 - el.clientWidth / 2,
      behavior: doux && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant',
    })
  }, [])

  // Ouvre directement sur la dernière étape vécue, sans animation.
  useLayoutEffect(() => {
    aller(depart, false)
    peindre()
  }, [aller, depart, peindre])

  useEffect(() => {
    const el = piste.current
    if (!el) return
    let image = 0
    const surDefilement = () => {
      cancelAnimationFrame(image)
      image = requestAnimationFrame(peindre)
    }
    el.addEventListener('scroll', surDefilement, { passive: true })
    window.addEventListener('resize', surDefilement)
    return () => {
      el.removeEventListener('scroll', surDefilement)
      window.removeEventListener('resize', surDefilement)
      cancelAnimationFrame(image)
    }
  }, [peindre])

  const derniere = etapes.length - 1

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol
        ref={piste}
        tabIndex={0}
        aria-label="Ton parcours, étape par étape"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            aller(Math.min(derniere, courante + 1))
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            aller(Math.max(0, courante - 1))
          }
        }}
        className="route-piste -mx-4 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none"
      >
        {etapes.map((etape, i) => (
          <Etape key={etape.cle} etape={etape} premiere={i === 0} derniere={i === derniere} active={i === courante} />
        ))}
      </ol>

      <div className="flex items-center gap-3 pt-3">
        <button
          type="button"
          onClick={() => aller(Math.max(0, courante - 1))}
          disabled={courante === 0}
          aria-label="Étape précédente"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-trait bg-carte text-lg disabled:opacity-30"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-haute">
            <div
              className="h-full rounded-full bg-choisir transition-[width] duration-300"
              style={{ width: `${etapes.length > 1 ? (courante / derniere) * 100 : 100}%` }}
            />
          </div>
          <p className="mt-1 flex justify-between text-[11px] text-encre-douce">
            <span className="tabular-nums">
              Étape {courante + 1} / {etapes.length}
            </span>
            {courante !== depart ? (
              <button type="button" onClick={() => aller(depart)} className="panneau text-accent">
                Revenir à aujourd’hui
              </button>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => aller(Math.min(derniere, courante + 1))}
          disabled={courante === derniere}
          aria-label="Étape suivante"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-trait bg-carte text-lg disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  )
}

function Etape({
  etape,
  premiere,
  derniere,
  active,
}: {
  etape: EtapeVue
  premiere: boolean
  derniere: boolean
  active: boolean
}) {
  const s = STYLE[etape.genre]
  const avenir = etape.genre === 'A_VENIR'

  const contenu = (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border bg-carte shadow-[0_10px_24px_-14px_rgb(0_58_93/0.45)] ${
        avenir ? 'border-2 border-dashed border-accent/50' : 'border-trait'
      }`}
    >
      <div className="h-1.5 shrink-0" style={{ background: avenir ? 'transparent' : s.fond }} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4">
        <p className="panneau text-[10px]" style={{ color: avenir ? 'var(--accent)' : 'var(--encre-douce)' }}>
          {s.label}
        </p>

        <h2 className="brush text-[2rem] leading-[1.05] break-words">{etape.titre}</h2>
        {etape.detail ? (
          <p className="line-clamp-4 text-sm whitespace-pre-line text-encre-douce">{etape.detail}</p>
        ) : null}

        {/* Le cœur de la carte : l'écusson gagné, ou un tampon comme sur un carnet de route. */}
        <div className="grid min-h-0 flex-1 place-items-center py-2">
          {etape.badge ? (
            <Ecusson {...etape.badge} taille={104} />
          ) : (
            <span
              aria-hidden
              className="grid aspect-square h-full max-h-32 min-h-16 -rotate-12 place-items-center rounded-full border-[3px] border-dashed opacity-25"
              style={{ borderColor: avenir ? 'var(--accent)' : s.fond, color: avenir ? 'var(--accent)' : s.fond }}
            >
              <PictoMasque cle={s.picto} taille={56} />
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-2">
          <p className="text-xs leading-tight text-encre-douce first-letter:uppercase">
            {dateLongue(etape.date)}
            <span className="block">{annee(etape.date)}</span>
          </p>
          {etape.points !== 0 ? (
            <span
              className={`brush shrink-0 rounded-full px-3 py-0.5 text-2xl leading-tight tabular-nums ${
                etape.points > 0 ? 'bg-choisir text-encre' : 'bg-erreur-doux text-erreur'
              }`}
            >
              {etape.points > 0 ? '+' : ''}
              {etape.points} pts
            </span>
          ) : avenir ? (
            <span className="panneau text-[10px] text-accent">À venir</span>
          ) : null}
        </div>
        <p className="flex justify-between border-t border-dashed border-trait pt-2 text-[11px] text-encre-douce">
          <span>{avenir ? 'Tu en es à' : 'Total sur ta route'}</span>
          <strong className="text-encre tabular-nums">{etape.cumul} pts</strong>
        </p>
      </div>
    </article>
  )

  return (
    <li
      className="route-etape relative flex shrink-0 snap-center snap-always flex-col"
      style={{ '--echelle': 1, '--opacite': 1 } as CSSProperties}
      aria-current={active ? 'step' : undefined}
    >
      {/* La station sur la route, et le pointillé qui part vers l'étape suivante. */}
      <div className="relative mb-3 flex h-14 shrink-0 items-center justify-center">
        {!derniere ? <Vague /> : null}
        {premiere ? null : <Vague gauche />}
        <span
          className={`relative z-10 grid size-14 place-items-center rounded-full border-4 border-surface shadow-md transition-transform duration-300 ${
            active ? 'scale-110' : ''
          } ${avenir ? 'border-dashed !border-accent' : ''}`}
          style={{ background: s.fond, color: s.encre }}
        >
          <PictoMasque cle={s.picto} taille={26} />
        </span>
      </div>
      <Link
        href={etape.lien ?? '#'}
        aria-disabled={!etape.lien}
        tabIndex={etape.lien ? undefined : -1}
        onClick={(e) => {
          if (!etape.lien || !active) e.preventDefault()
        }}
        className={`route-carte min-h-0 flex-1 ${etape.lien && active ? '' : 'cursor-default'}`}
      >
        {contenu}
      </Link>
    </li>
  )
}

/** Un demi-tronçon de route : pointillé orange ondulé, du centre de la station vers le bord. */
function Vague({ gauche = false }: { gauche?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={`absolute top-1/2 h-8 -translate-y-1/2 ${gauche ? 'right-1/2' : 'left-1/2'}`}
      style={{ width: 'calc(50% + var(--route-ecart) / 2 + 1px)' }}
    >
      <path
        // Une ondulation par demi-tronçon : la bosse de gauche répond au creux de droite.
        d={gauche ? 'M0 16 C20 32 30 32 50 16 S80 0 100 16' : 'M0 16 C20 0 30 0 50 16 S80 32 100 16'}
        fill="none"
        stroke="var(--choisir)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="0 10"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
