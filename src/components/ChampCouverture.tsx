'use client'

import { useEffect, useState } from 'react'
import { PictoMasque } from '@/components/sgdf/PictoMasque'
import { reduireChampPhotos } from '@/lib/ui/reduirePhoto'

interface Props {
  /** Couverture actuelle, pour l'aperçu. */
  actuelle?: string | null
  name?: string
  onReduction?: (enCours: boolean) => void
}

/**
 * Champ d'image de couverture : aperçu au format du bandeau (16:9), photo
 * allégée dans le navigateur avant l'envoi, recadrée par le serveur.
 */
export function ChampCouverture({ actuelle = null, name = 'cover', onReduction }: Props) {
  const [apercu, setApercu] = useState<string | null>(actuelle)
  const [reduction, setReduction] = useState(false)

  useEffect(() => {
    return () => {
      if (apercu?.startsWith('blob:')) URL.revokeObjectURL(apercu)
    }
  }, [apercu])

  return (
    <label className="group relative grid aspect-video cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-trait bg-surface hover:border-encre-douce">
      {apercu ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou image privée
        <img src={apercu} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <span
        className={`relative flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-center text-sm ${
          apercu ? 'bg-carte/90 opacity-0 shadow transition-opacity group-hover:opacity-100' : ''
        }`}
      >
        <PictoMasque cle="appareil_photo" taille={30} className="text-accent" />
        <strong>{reduction ? 'Allègement…' : apercu ? 'Changer la couverture' : 'Ajouter une couverture'}</strong>
        {!apercu ? <span className="text-xs text-encre-douce">Facultatif · cadrée en 16:9</span> : null}
      </span>
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={async (e) => {
          const input = e.currentTarget
          const fichier = input.files?.[0]
          if (!fichier) return
          setReduction(true)
          onReduction?.(true)
          const [reduite] = await reduireChampPhotos(input)
          setReduction(false)
          onReduction?.(false)
          setApercu(URL.createObjectURL(reduite ?? fichier))
        }}
      />
    </label>
  )
}
