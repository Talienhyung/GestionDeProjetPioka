/**
 * Amorçage idempotent : badges, catalogue de tâches, super admin s'il n'existe
 * pas, premier CAP. Écrit là où pointe l'environnement : DynamoDB si
 * DYNAMODB_TABLE est défini, sinon le fichier local (DATA_FILE).
 */
import { db as prisma } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth/password'

const APPARENCES: Record<string, { pictoKey: string; color: string; level: number }> = {
  premier_pas: { pictoKey: 'graine', color: '#007254', level: 1 },
  bosseur_1: { pictoKey: 'flamme', color: '#ff8300', level: 1 },
  bosseur_2: { pictoKey: 'trek', color: '#d03f15', level: 2 },
  bosseur_3: { pictoKey: 'coupe', color: '#003a5d', level: 4 },
  costaud: { pictoKey: 'montagne', color: '#6e74aa', level: 2 },
  equipe: { pictoKey: 'tribu', color: '#007254', level: 2 },
  debut_fin: { pictoKey: 'boussole', color: '#003a5d', level: 3 },
  sans_faute: { pictoKey: 'etoile', color: '#d03f15', level: 3 },
  responsable: { pictoKey: 'promesse', color: '#6e74aa', level: 3 },
  photographe: { pictoKey: 'appareil_photo', color: '#ff8300', level: 1 },
}

const BADGES = [
  { code: 'premier_pas', name: 'Premier pas', description: 'Ta toute première tâche validée.', icon: '🌱', ruleType: 'TACHES_VALIDEES', threshold: 1, points: 5, sortOrder: 1 },
  { code: 'bosseur_1', name: 'Bosseur I', description: '5 tâches validées.', icon: '🔥', ruleType: 'TACHES_VALIDEES', threshold: 5, points: 10, sortOrder: 2 },
  { code: 'bosseur_2', name: 'Bosseur II', description: '15 tâches validées.', icon: '🚀', ruleType: 'TACHES_VALIDEES', threshold: 15, points: 25, sortOrder: 3 },
  { code: 'bosseur_3', name: 'Bosseur III', description: '30 tâches validées.', icon: '🏆', ruleType: 'TACHES_VALIDEES', threshold: 30, points: 50, sortOrder: 4 },
  { code: 'costaud', name: 'Costaud', description: 'Une tâche difficile menée au bout.', icon: '💪', ruleType: 'TACHE_DIFFICILE', threshold: 1, points: 10, sortOrder: 5 },
  { code: 'equipe', name: 'Esprit d\'équipe', description: '5 tâches réalisées à plusieurs.', icon: '🤝', ruleType: 'TACHES_EN_EQUIPE', threshold: 5, points: 15, sortOrder: 6 },
  { code: 'debut_fin', name: 'Du début à la fin', description: 'Une tâche validée dans chacune des trois phases d\'un même CAP.', icon: '🧭', ruleType: 'TOUTES_PHASES', threshold: 3, points: 20, sortOrder: 7 },
  { code: 'sans_faute', name: 'Sans faute', description: '3 validations d\'affilée sans aucun refus.', icon: '🎯', ruleType: 'SERIE_SANS_REFUS', threshold: 3, points: 15, sortOrder: 8 },
  { code: 'responsable', name: 'Responsable', description: 'Un rôle du CAP tenu jusqu\'au bout.', icon: '🎖️', ruleType: 'ROLE_CLOTURE', threshold: 1, points: 15, sortOrder: 9 },
  { code: 'photographe', name: 'Photographe', description: '5 soumissions accompagnées d\'une photo.', icon: '📸', ruleType: 'SOUMISSIONS_AVEC_PHOTO', threshold: 5, points: 10, sortOrder: 10 },
]

const TEMPLATES = [
  ['CHOISIR', 'FACILE', 'Recueillir les idées de chacun', 'Faire le tour de l\'équipe et noter toutes les idées de projet, sans en écarter aucune.'],
  ['CHOISIR', 'FACILE', 'Présenter les idées à l\'équipe', 'Mettre les idées au propre et les présenter pour que tout le monde les comprenne.'],
  ['CHOISIR', 'FACILE', 'Organiser le vote du projet', 'Organiser le vote et annoncer le projet retenu.'],
  ['CHOISIR', 'MOYEN', 'Définir l\'objectif du projet', 'Écrire en quelques phrases ce que le projet veut accomplir.'],
  ['CHOISIR', 'MOYEN', 'Identifier à qui le projet profite', 'Dire qui bénéficie du projet en dehors de l\'équipe.'],
  ['CHOISIR', 'FACILE', 'Fixer les grandes dates', 'Poser les dates clés du projet sur un calendrier.'],
  ['AGIR', 'DIFFICILE', 'Établir le budget prévisionnel', 'Lister toutes les dépenses et toutes les recettes attendues.'],
  ['AGIR', 'DIFFICILE', 'Chercher des financements', 'Trouver des pistes de financement et préparer les demandes.'],
  ['AGIR', 'MOYEN', 'Contacter les partenaires', 'Prendre contact avec les personnes et structures qui peuvent aider.'],
  ['AGIR', 'MOYEN', 'Réserver le lieu', 'Trouver le lieu, vérifier qu\'il convient et le réserver.'],
  ['AGIR', 'MOYEN', 'Préparer le matériel', 'Lister le matériel nécessaire, vérifier l\'état et compléter ce qui manque.'],
  ['AGIR', 'MOYEN', 'Organiser le transport', 'Trouver comment tout le monde se rend sur place, et à quelle heure.'],
  ['AGIR', 'FACILE', 'Répartir les responsabilités', 'Attribuer à chacun ce dont il s\'occupe pendant le projet.'],
  ['AGIR', 'MOYEN', 'Préparer la communication', 'Préparer les affiches, messages et publications sur le projet.'],
  ['AGIR', 'DIFFICILE', 'Rédiger le dossier de projet', 'Mettre le projet par écrit, de l\'objectif au budget.'],
  ['AGIR', 'MOYEN', 'Vérifier les autorisations', 'S\'assurer que toutes les autorisations nécessaires sont obtenues.'],
  ['PARTAGER', 'MOYEN', 'Réaliser le reportage photo', 'Prendre des photos pendant le projet et les rassembler.'],
  ['PARTAGER', 'MOYEN', 'Préparer la veillée de partage', 'Imaginer et préparer le temps où le projet sera raconté.'],
  ['PARTAGER', 'MOYEN', 'Présenter le projet au groupe', 'Raconter le projet aux autres unités ou aux parents.'],
  ['PARTAGER', 'FACILE', 'Remercier les partenaires', 'Écrire aux personnes et structures qui ont aidé.'],
  ['PARTAGER', 'MOYEN', 'Faire la relecture du projet', 'Prendre un temps d\'équipe pour relire le projet ensemble.'],
  ['PARTAGER', 'FACILE', 'Évaluer ce qu\'on a appris', 'Noter ce que chacun retient et ce qu\'on referait autrement.'],
] as const

async function main() {
  for (const badge of BADGES) {
    // update vide : un seuil ou des points ajustés par le super admin ne doivent
    // pas être réécrits au prochain démarrage du conteneur.
    await prisma.badge.upsert({ where: { code: badge.code }, update: {}, create: badge })
  }

  // Apparence des badges d'origine (picto, couleur, niveau), posée une seule
  // fois : un badge déjà personnalisé par l'admin n'est pas touché.
  for (const [code, look] of Object.entries(APPARENCES)) {
    const badge = await prisma.badge.findUnique({ where: { code } })
    if (badge && !badge.pictoKey && !badge.imageName && !badge.color) {
      await prisma.badge.update({ where: { code }, data: look })
    }
  }

  if ((await prisma.taskTemplate.count({ where: { isBuiltin: true } })) === 0) {
    await prisma.taskTemplate.createMany({
      data: TEMPLATES.map(([phase, difficulty, title, description]) => ({
        phase, difficulty, title, description, isBuiltin: true,
      })),
    })
  }

  const username = (process.env.SUPER_ADMIN_USERNAME ?? 'admin').toLowerCase()
  const password = process.env.SUPER_ADMIN_PASSWORD
  if (!(await prisma.user.findUnique({ where: { username } }))) {
    if (!password) throw new Error('SUPER_ADMIN_PASSWORD est requis au premier démarrage.')
    await prisma.user.create({
      data: {
        username,
        displayName: 'Super admin',
        role: 'SUPER_ADMIN',
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
    })
    console.log(`Super admin « ${username} » créé.`)
  }

  if ((await prisma.project.count()) === 0) {
    await prisma.project.create({ data: { title: 'Notre premier CAP', currentPhase: 'CHOISIR' } })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
