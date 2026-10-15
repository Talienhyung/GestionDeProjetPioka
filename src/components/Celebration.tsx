'use client'

import { useEffect, useState } from 'react'

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
    const timer = setTimeout(() => setPieces([]), 4000)
    return () => clearTimeout(timer)
  }, [trigger])

  if (pieces.length === 0) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute top-0 text-2xl"
          style={{
            left: `${(i * 37) % 100}%`,
            animation: `chute ${2 + (i % 5) * 0.3}s linear ${(i % 7) * 0.12}s 1`,
          }}
        >
          {['🎉', '⭐', '🎊', '✨'][i % 4]}
        </span>
      ))}
      <style>{`@keyframes chute { to { transform: translateY(105vh) rotate(540deg); opacity: 0; } }`}</style>
    </div>
  )
}
