'use client'

import { useEffect, useState } from 'react'
import { Picto } from '@/components/sgdf/Picto'
import type { NomPicto } from '@/components/sgdf/pictos'

const CONFETTIS: { nom: NomPicto; couleur: string }[] = [
  { nom: 'etoile', couleur: 'text-choisir' },
  { nom: 'lys', couleur: 'text-accent' },
  { nom: 'etincelle', couleur: 'text-partager' },
  { nom: 'drapeau', couleur: 'text-agir' },
]

/** Confettis affichés une fois, quand une tâche vient d'être validée. */
export function Celebration({ trigger }: { trigger: string | null }) {
  const [pieces, setPieces] = useState<number[]>([])

  useEffect(() => {
    if (!trigger) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const seen = (() => {
      try {
        return localStorage.getItem('fete') === trigger
      } catch {
        return false
      }
    })()
    if (seen) return

    try {
      localStorage.setItem('fete', trigger)
    } catch {
      // Navigation privée : on fête quand même, simplement à chaque visite.
    }

    setPieces(Array.from({ length: 40 }, (_, i) => i))
    // Chaque confetti se retire lui-même à la fin de sa chute (onAnimationEnd).
    // Filet de sécurité volontairement non annulé : la minuterie d'avant était
    // annulée par le double montage de React en développement, et les
    // confettis restaient affichés en haut de l'écran.
    setTimeout(() => setPieces([]), 6000)
  }, [trigger])

  if (pieces.length === 0) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((i) => (
        <span
          key={i}
          className={`absolute -top-8 ${CONFETTIS[i % CONFETTIS.length].couleur}`}
          style={{
            left: `${(i * 37) % 100}%`,
            // « both » : caché au-dessus de l'écran pendant le délai, et
            // transparent en bas une fois tombé, jamais figé en haut.
            animation: `chute ${2 + (i % 5) * 0.3}s linear ${(i % 7) * 0.12}s 1 both`,
          }}
          onAnimationEnd={() => setPieces((p) => p.filter((x) => x !== i))}
        >
          <Picto nom={CONFETTIS[i % CONFETTIS.length].nom} taille={22} />
        </span>
      ))}
      <style>{`@keyframes chute { from { transform: translateY(0) rotate(0deg); opacity: 1; } to { transform: translateY(110vh) rotate(540deg); opacity: 0; } }`}</style>
    </div>
  )
}
