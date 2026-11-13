import { BadgeForm } from '@/components/BadgeForm'
import { PageHeader } from '@/components/PageHeader'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getRecentColors } from '@/lib/services/badgeAdminService'

export default async function NouveauBadgePage() {
  await requireSuperAdmin()
  const [couleurs, dernier] = await Promise.all([
    getRecentColors(db),
    db.badge.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }),
  ])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titre="Nouveau badge" retour={{ href: '/badges', label: 'Badges' }} />
      <BadgeForm badge={null} couleursRecentes={couleurs} ordreSuivant={(dernier?.sortOrder ?? 0) + 1} />
    </div>
  )
}
