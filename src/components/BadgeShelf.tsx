// src/components/BadgeShelf.tsx
interface Props {
  badges: { id: string; code: string; name: string; description: string; icon: string }[]
  earned: Map<string, Date>
}

export function BadgeShelf({ badges, earned }: Props) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {badges.map((badge) => {
        const date = earned.get(badge.id)
        return (
          <li
            key={badge.id}
            className={`rounded-xl border p-3 text-center ${date ? 'bg-amber-50 dark:bg-amber-950' : 'opacity-50'}`}
          >
            <span className="text-3xl" aria-hidden>{badge.icon}</span>
            <p className="mt-1 text-xs font-semibold">{badge.name}</p>
            <p className="text-[11px] opacity-80">{badge.description}</p>
            {date ? (
              <p className="mt-1 text-[10px]">obtenu le {date.toLocaleDateString('fr-FR')}</p>
            ) : (
              <p className="mt-1 text-[10px]">à débloquer</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
