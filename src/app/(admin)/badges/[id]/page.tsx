import { notFound } from 'next/navigation'
import { BadgeForm } from '@/components/BadgeForm'
import { PageHeader } from '@/components/PageHeader'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getRecentColors } from '@/lib/services/badgeAdminService'
import { apparenceBadge } from '@/lib/ui/apparenceBadge'

export default async function ModifierBadgePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin()
  const { id } = await params
  const [badge, couleurs] = await Promise.all([
    db.badge.findUnique({ where: { id }, include: { _count: { select: { userBadges: true } } } }),
    getRecentColors(db),
  ])
  if (!badge) notFound()
  const look = apparenceBadge(badge)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titre="Modifier le badge" retour={{ href: '/badges', label: 'Badges' }} />
      <BadgeForm
        badge={{
          id: badge.id,
          name: badge.name,
          description: badge.description,
          ruleType: badge.ruleType,
          threshold: badge.threshold,
          points: badge.points,
          sortOrder: badge.sortOrder,
          level: badge.level,
          color: look.color,
          pictoKey: look.pictoKey,
          imageUrl: look.imageUrl,
          earnedCount: badge._count.userBadges,
        }}
        couleursRecentes={couleurs}
        ordreSuivant={badge.sortOrder}
      />
    </div>
  )
}
