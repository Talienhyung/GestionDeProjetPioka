'use client'

import { useRef } from 'react'
import { BadgePicto } from '@/components/sgdf/BadgePicto'

interface Props {
  code: string
  icon: string
  name: string
  description: string
  /** Pourquoi le jeune l'a gagné, en clair. */
  reason: string
  earnedAt: Date
  projectTitle: string | null
  points: number
  teinte: string
  inclinaison: string
}

/** Un écusson du profil ; un appui ouvre sa fiche : quand, quoi, pourquoi. */
export function EcussonBadge(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const quand = props.earnedAt.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="group flex flex-col items-center text-center"
        aria-haspopup="dialog"
      >
        <span
          className={`grid size-20 place-items-center rounded-full border-4 border-dashed border-carte/60 shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-0 group-focus-visible:scale-110 ${props.teinte} ${props.inclinaison}`}
        >
          <BadgePicto code={props.code} icon={props.icon} taille={40} />
        </span>
        <span className="panneau mt-2 text-[11px] leading-tight">{props.name}</span>
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => {
          // Un appui sur le fond referme la fiche.
          if (e.target === dialog.current) dialog.current?.close()
        }}
        className="ecusson-fiche m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-carte p-0 text-encre shadow-2xl backdrop:bg-institution/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
          <span
            className={`grid size-28 place-items-center rounded-full border-[5px] border-dashed border-carte/60 shadow-lg ${props.teinte}`}
          >
            <BadgePicto code={props.code} icon={props.icon} taille={58} />
          </span>

          <div>
            <h2 className="brush text-4xl leading-none text-accent">{props.name}</h2>
            <p className="mt-1 text-sm text-encre-douce">{props.description}</p>
          </div>

          <dl className="flex w-full flex-col gap-2 text-left text-sm">
            <div className="rounded-lg bg-surface p-3">
              <dt className="panneau text-[10px] text-encre-douce">Pourquoi</dt>
              <dd>{props.reason}</dd>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <dt className="panneau text-[10px] text-encre-douce">Gagné le</dt>
              <dd className="first-letter:uppercase">
                {quand}
                {props.projectTitle ? <span className="text-encre-douce"> · {props.projectTitle}</span> : null}
              </dd>
            </div>
          </dl>

          {props.points > 0 ? (
            <p className="panneau text-[11px] text-ok">+{props.points} points en bonus</p>
          ) : null}

          <form method="dialog" className="w-full">
            <button className="panneau w-full rounded-lg bg-bouton p-3 text-sm text-sur-bouton">Super !</button>
          </form>
        </div>
      </dialog>
    </>
  )
}
