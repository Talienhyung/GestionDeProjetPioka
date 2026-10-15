import Link from 'next/link'
import { BadgeShelf } from '@/components/BadgeShelf'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getLedger, getScore } from '@/lib/services/pointsService'

const MOTIFS: Record<string, string> = {
  TACHE: 'Tâche validée',
  BONUS: 'Bonus',
  ROLE: 'Rôle tenu',
  BADGE: 'Badge débloqué',
  ANNULATION: 'Validation annulée',
}

export default async function ProfilPage() {
  const user = await requireUser()
  const [score, ledger, badges, earned] = await Promise.all([
    getScore(db, user.id),
    getLedger(db, user.id),
    db.badge.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.userBadge.findMany({ where: { userId: user.id } }),
  ])

  const earnedMap = new Map(earned.map((userBadge) => [userBadge.badgeId, userBadge.earnedAt]))

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-emerald-600 p-5 text-white">
        <p className="text-sm opacity-90">{user.displayName}</p>
        <p className="text-4xl font-black">{score} pts</p>
        <p className="mt-1 text-sm">{earned.length} badge(s) sur {badges.length}</p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-bold">Mes badges</h2>
        <BadgeShelf badges={badges} earned={earnedMap} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">D&apos;où viennent mes points</h2>
        {ledger.length === 0 ? (
          <p className="text-sm opacity-70">Aucun point pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ledger.map((ligne) => (
              <li key={ligne.id} className="flex items-baseline justify-between gap-3 rounded-lg border p-2 text-sm">
                <span>
                  {MOTIFS[ligne.reason] ?? ligne.reason}
                  {ligne.taskTitle ? <span className="opacity-70"> · {ligne.taskTitle}</span> : null}
                </span>
                <span className={`font-semibold ${ligne.amount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {ligne.amount > 0 ? '+' : ''}{ligne.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/profil/mot-de-passe" className="rounded-lg border p-3 text-center font-semibold">
        Changer mon mot de passe
      </Link>
    </div>
  )
}
