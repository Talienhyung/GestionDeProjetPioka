# Gestion de projet CAP — Pionniers-Caravelles SGDF

Document de conception — 15 octobre 2026

## 1. Intention

Permettre aux jeunes d'une caravane Pionniers-Caravelles de mener leur CAP
(Choisir-Agir-Partager) de façon autonome et motivante, pendant que les chefs
gardent la main sur ce qui est validé.

Un jeune s'inscrit sur une tâche ou se porte candidat à un rôle, réalise le
travail, le soumet ; un chef accepte — le jeune gagne des points — ou refuse
avec un commentaire, et le jeune corrige. Les points et les badges rendent la
démarche de projet visible et ludique.

### Utilisateurs

- **Jeune** (14-17 ans, sur téléphone) : s'inscrit, réalise, soumet, suit ses points.
- **Chef** : crée les tâches, valide ou refuse, pilote le CAP, réinitialise les mots de passe.
- **Super admin** : crée les comptes, règle le barème et les badges.

### Critères de réussite

1. Un jeune comprend seul, sans explication, comment prendre une tâche et la soumettre.
2. Un chef traite sa file de validation en quelques minutes depuis son téléphone.
3. Les jeunes reviennent sur le site d'eux-mêmes entre deux réunions.
4. Le chef peut archiver un CAP et en démarrer un nouveau l'année suivante sans perdre l'historique.

### Non-objectifs

Ce n'est pas un outil pour plusieurs groupes SGDF, ni un outil de communication,
ni un outil de gestion budgétaire.

## 2. Contexte et contraintes

| Contrainte | Décision |
|---|---|
| Hébergement | Serveur auto-géré par le chef, via Docker |
| Périmètre | Une seule caravane, plusieurs CAP (en cours + archivés) |
| Stack | TypeScript, Next.js 15 (App Router), React, Prisma, SQLite, Tailwind |
| Usage | Mobile-first, interface entièrement en français |
| Comptes | Aucune inscription publique ; comptes créés par le super admin |
| Données personnelles | Aucun email, aucune date de naissance, aucune adresse |
| Ton | Coloré et ludique, assumé « jeu » |

La contrainte « aucune donnée personnelle » est structurante : les utilisateurs
sont des mineurs. Un compte se résume à un identifiant, un nom affiché et un
hash de mot de passe. Les photos jointes aux soumissions ne sont jamais servies
publiquement.

## 3. Architecture

Application Next.js monolithique. Le navigateur parle à des Server Actions, qui
appellent la couche métier, qui appelle Prisma.

```
Navigateur (React, mobile-first)
      │  Server Actions
      ▼
src/lib/  ← toute la logique métier, testable sans base
      │
      ▼
Prisma → SQLite (fichier sur un volume Docker)
```

### Arborescence

```
src/
  app/
    (auth)/login/
    (app)/                      espace connecté
      accueil/                  tableau de bord du jeune
      cap/                      tableau des tâches par phase
      cap/[taskId]/             détail d'une tâche
      roles/
      classement/
      profil/
    (chef)/
      validation/               file de validation
      taches/                   création et édition
      roles/
      pilotage/                 phases, archivage, nouveau CAP
      membres/                  réinitialisation des mots de passe
    (admin)/
      comptes/
      parametres/
    api/fichiers/[id]/          service protégé des photos
  components/
  lib/
    auth/           sessions, hachage, autorisation
    points.ts       calcul et attribution des points
    badges.ts       moteur de règles des badges
    tasks.ts        machine à états des tâches
    uploads.ts      validation et stockage des photos
    notifications.ts
    db.ts
prisma/
  schema.prisma
  migrations/
  seed.ts           super admin + catalogue de tâches types + badges
tests/
Dockerfile
docker-compose.yml
```

### Règle de conception

Toute la logique de décision (points, badges, transitions de statut,
autorisations) vit dans `src/lib` sous forme de fonctions pures prenant des
données en entrée et rendant un résultat. Les Server Actions ne font que lire la
session, charger les données, appeler ces fonctions et écrire le résultat. C'est
ce qui rend le cœur du produit testable sans base de données et sans navigateur.

## 4. Modèle de données

```prisma
enum Role            { SUPER_ADMIN CHEF JEUNE }
enum Phase           { CHOISIR AGIR PARTAGER }
enum Difficulty      { FACILE MOYEN DIFFICILE }
enum ProjectStatus   { BROUILLON EN_COURS ARCHIVE }
enum TaskStatus      { PROPOSEE REJETEE OUVERTE EN_COURS SOUMISE A_CORRIGER TERMINEE }
enum ReviewDecision  { ACCEPTEE REFUSEE }
enum RoleAppStatus   { EN_ATTENTE ACCEPTEE REFUSEE }
```

| Modèle | Champs principaux |
|---|---|
| `User` | `username` (unique), `displayName`, `passwordHash`, `role`, `mustChangePassword`, `isActive`, `createdAt` |
| `Session` | `id`, `userId`, `expiresAt`, `createdAt` |
| `Project` | `title`, `description`, `currentPhase`, `status`, `startedAt`, `archivedAt` |
| `Task` | `projectId`, `title`, `description`, `phase`, `difficulty`, `status`, `createdById`, `dueDate?`, `templateId?` |
| `TaskAssignment` | `taskId`, `userId`, `joinedAt` — unique sur (`taskId`,`userId`) |
| `Submission` | `taskId`, `submittedById`, `message`, `createdAt`, `decision?`, `reviewedById?`, `reviewedAt?`, `reviewComment?`, `bonusPoints?` |
| `Attachment` | `submissionId`, `storedName`, `originalName`, `mimeType`, `sizeBytes`, `width`, `height`, `uploadedById` |
| `ProjectRole` | `projectId`, `name`, `description`, `points`, `holderId?`, `closedAt?` |
| `RoleApplication` | `projectRoleId`, `userId`, `status`, `createdAt`, `decidedById?` |
| `TaskTemplate` | `title`, `description`, `phase`, `difficulty`, `isBuiltin`, `isArchived` |
| `Badge` | `code` (unique), `name`, `description`, `icon`, `ruleType`, `threshold`, `points` |
| `UserBadge` | `userId`, `badgeId`, `earnedAt`, `projectId?` — unique sur (`userId`,`badgeId`) |
| `PointsEntry` | `userId`, `projectId`, `amount`, `reason`, `taskId?`, `projectRoleId?`, `badgeId?`, `createdAt` |
| `Notification` | `userId`, `type`, `message`, `link`, `readAt?`, `createdAt` |
| `Setting` | `key` (unique), `value` — barème et réglages |

### Le grand livre des points

Le score d'un jeune n'est jamais un compteur stocké sur son profil : c'est la
somme de ses `PointsEntry`. Chaque gain écrit une ligne avec son motif et sa
source. Conséquences : le jeune peut consulter le détail de son score, une
validation annulée par erreur s'annule par une ligne négative sans risque de
désynchronisation, et le classement d'un CAP archivé reste juste pour toujours.

## 5. Cycle de vie d'une tâche

```
                      ┌──────────────────────────────┐
  créée par un chef   │                              │
  ───────────────────►│           OUVERTE            │◄──┐
                      │                              │   │
  créée par un jeune  └──────────────────────────────┘   │ dernier inscrit
  ──► PROPOSEE ──(chef accepte)──┘        │              │ se désinscrit
          │                       inscription            │
    (chef refuse)                         ▼              │
          ▼                      ┌──────────────┐        │
       REJETEE                   │   EN_COURS   │────────┘
                                 └──────────────┘
                                         │ soumission
                                         ▼
                                 ┌──────────────┐
                                 │   SOUMISE    │◄────────┐
                                 └──────────────┘         │
                                   │          │           │
                     chef accepte  │          │ chef refuse (commentaire
                                   ▼          ▼            obligatoire)
                             ┌──────────┐  ┌─────────────┐
                             │ TERMINEE │  │ A_CORRIGER  │─ nouvelle soumission ─┘
                             └──────────┘  └─────────────┘
```

Règles :

- Une tâche créée par un chef naît `OUVERTE` ; créée par un jeune, `PROPOSEE`.
- On ne peut s'inscrire que sur `OUVERTE` ou `EN_COURS`.
- Un jeune peut se désinscrire tant qu'aucune soumission n'a été faite sur la
  tâche. Après une première soumission, seul un chef peut retirer un participant
  — sinon un jeune pourrait s'effacer d'un travail déjà rendu.
- Seul un inscrit peut soumettre ; la soumission concerne la tâche entière, pas l'individu.
- Un refus exige un commentaire non vide. Il n'est jamais terminal : la tâche
  revient `A_CORRIGER` et peut être resoumise autant de fois que nécessaire.
- Toutes les soumissions sont conservées : le fil de la tâche montre l'historique
  complet des échanges entre le jeune et le chef.
- Un chef peut annuler une validation (ligne de points négative, retour `A_CORRIGER`).
- Les tâches d'un CAP archivé sont en lecture seule.

Cette machine à états est implémentée dans `src/lib/tasks.ts` sous forme d'une
table de transitions autorisées `(statut, action, rôle) → statut`. Toute action
passe par elle ; aucune action serveur ne modifie `status` directement.

## 6. Points

Barème par défaut, modifiable dans les paramètres : **Facile 10 · Moyen 25 · Difficile 50**.

À la validation d'une tâche, chaque participant reçoit :

```
points = arrondi_supérieur(socle ÷ nombre_de_participants) + bonus
```

L'arrondi au supérieur évite les restes perdus et rend la coopération
légèrement avantageuse, sans supprimer l'intérêt de se répartir les tâches. Le
bonus décidé par le chef s'applique intégralement à chaque participant : c'est
une récompense de qualité, pas un gâteau à partager. Il est plafonné au socle de
la tâche pour éviter les dérives.

Un `ProjectRole` verse ses points à son titulaire quand un chef clôture le rôle.

Le calcul vit dans `src/lib/points.ts` :

```ts
computeTaskAward(difficulty, participantCount, bonus, scale) → number
```

Fonction pure, testée pour : un seul participant, plusieurs participants avec
reste, bonus nul, bonus au plafond, barème modifié.

## 7. Badges

Évalués après chaque écriture de points, par un moteur de règles pur
`evaluateBadges(stats) → codes[]` qui reçoit les statistiques du jeune et rend
les badges mérités. Les badges déjà obtenus sont ignorés. Chaque badge peut
rapporter des points.

| Code | Nom | Condition |
|---|---|---|
| `premier_pas` | Premier pas | 1ʳᵉ tâche validée |
| `bosseur_1/2/3` | Bosseur I / II / III | 5 / 15 / 30 tâches validées |
| `costaud` | Costaud | une tâche difficile validée |
| `equipe` | Esprit d'équipe | 5 tâches validées à plusieurs |
| `debut_fin` | Du début à la fin | au moins une tâche validée dans chacune des 3 phases d'un même CAP |
| `sans_faute` | Sans faute | 3 validations d'affilée sans refus |
| `responsable` | Responsable | un rôle tenu jusqu'à sa clôture |
| `photographe` | Photographe | 5 soumissions accompagnées d'une photo |

Les badges sont des lignes en base (`Badge`), pas du code en dur : le super admin
peut ajuster seuils et points, et en ajouter plus tard sans redéploiement.

## 8. Rôles du CAP

Un `ProjectRole` est une responsabilité durable sur un projet : trésorier,
intendant, responsable communication, responsable matériel, secrétaire. Un seul
titulaire à la fois.

Un jeune se porte **candidat** ; un chef attribue le rôle. Ce détour par la
candidature est nécessaire parce que deux jeunes peuvent viser le même rôle : il
faut un arbitrage, pas un premier-arrivé-premier-servi. Les candidatures non
retenues sont marquées refusées et notifiées.

À la clôture du rôle par un chef, le titulaire reçoit les points et le badge
`responsable` est évalué.

## 9. Photos des soumissions

Un jeune peut joindre **jusqu'à 3 photos** à une soumission, 8 Mo chacune au
maximum, en JPEG, PNG ou WebP. À l'envoi, le serveur vérifie le type réel du
fichier (pas seulement son extension), le réencode en WebP avec `sharp` — ce qui
supprime au passage les métadonnées EXIF, dont la géolocalisation — le
redimensionne à 1600 px maximum sur le grand côté, et l'enregistre sous un nom
aléatoire sur le volume Docker, dans `/data/uploads`.

Les fichiers ne sont jamais servis en statique. La route `api/fichiers/[id]`
vérifie la session avant de renvoyer l'image. Ce sont des photos de mineurs :
une URL devinable ou partageable hors du site serait un vrai problème.

La suppression d'une soumission supprime ses fichiers.

## 10. Authentification et autorisation

- Mots de passe hachés en **argon2id**.
- Sessions stockées en base, cookie `httpOnly`, `SameSite=Lax`, `Secure` en production, 30 jours glissants.
- Limitation des tentatives de connexion : 10 échecs par identifiant et par quart d'heure.
- Création de compte par le super admin : mot de passe provisoire affiché **une seule fois**, `mustChangePassword` activé, changement forcé à la première connexion.
- Oubli de mot de passe : un chef en génère un nouveau depuis l'écran Membres. Aucun envoi d'email, aucune question secrète.
- Un compte se désactive, ne se supprime pas : son historique de points et ses contributions restent cohérents.

Autorisation centralisée dans `src/lib/auth/guard.ts` :

```ts
requireUser()                  → session valide, sinon redirection login
requireChef()                  → rôle CHEF ou SUPER_ADMIN
requireSuperAdmin()
canActOnTask(user, task, action) → booléen, utilisé par la machine à états
```

**Chaque** Server Action appelle une garde en première ligne. Masquer un bouton
dans l'interface n'est jamais considéré comme un contrôle d'accès.

## 11. Notifications

Dans le site uniquement : cloche dans l'en-tête avec le nombre de non-lues, et
page dédiée. Déclencheurs : tâche acceptée, tâche refusée (avec le commentaire),
tâche proposée acceptée ou refusée, badge débloqué, rôle attribué ou refusé,
nouvelle tâche ouverte dans le CAP, changement de phase du projet.

Pour un chef : nouvelle soumission à traiter, nouvelle tâche proposée, nouvelle
candidature à un rôle.

## 12. Écrans

**Commun** — Connexion. Changement de mot de passe forcé à la première connexion.

**Jeune**

| Écran | Contenu |
|---|---|
| Accueil | mes tâches en cours, mon score et ma progression, mes derniers badges, notifications |
| Le CAP | tableau des tâches groupées par phase, filtres (libres / les miennes / à corriger) |
| Détail d'une tâche | description, participants, fil des soumissions et commentaires, actions : s'inscrire, se désinscrire, soumettre (message + photos) |
| Rôles | rôles du CAP, titulaires, candidater |
| Classement | classement de la caravane, badges de chacun |
| Profil | mes points en détail, mes badges, changer mon mot de passe |

**Chef** — tout ce qui précède, plus :

| Écran | Contenu |
|---|---|
| Validation | file unique : soumissions à traiter, tâches proposées, candidatures. Accepter avec bonus, ou refuser avec commentaire |
| Tâches | créer depuis zéro ou depuis le catalogue, éditer, enregistrer comme modèle |
| Rôles | créer, attribuer, clôturer |
| Pilotage | changer la phase courante, archiver le CAP, en créer un nouveau |
| Membres | liste des jeunes, réinitialiser un mot de passe |

**Super admin** — tout ce qui précède, plus la gestion des comptes (créer,
désactiver, changer de rôle) et les paramètres (barème, badges, catalogue).

## 13. Interface

Mobile-first, Tailwind. Une couleur par phase, tenue dans toute l'application :
Choisir, Agir, Partager. Jauge de progression du CAP et jauge par phase.
Animation et confettis à l'annonce d'une validation. Badges en vitrine sur le
profil, grisés tant qu'ils ne sont pas débloqués, avec leur condition affichée —
un badge verrouillé dont on connaît la condition est un objectif, un badge
verrouillé mystérieux est une frustration. Thème clair et sombre.

## 14. Tests

Développement en TDD.

| Niveau | Outil | Couverture visée |
|---|---|---|
| Unitaire | Vitest | `points.ts`, `badges.ts`, `tasks.ts`, `guard.ts`, `uploads.ts` — les règles métier, exhaustivement |
| Intégration | Vitest + SQLite temporaire | Server Actions : un jeune ne peut pas valider sa propre tâche, une tâche archivée est en lecture seule, une re-soumission fonctionne, un refus sans commentaire est rejeté |
| Bout en bout | Playwright | connexion et changement de mot de passe forcé ; cycle complet inscription → soumission → refus → correction → validation → points → badge |

## 15. Déploiement

`docker-compose.yml` : un service `app`, un volume monté sur `/data` contenant
`cap.db` et `uploads/`. Image multi-étapes construite sur la sortie `standalone`
de Next.js. Migrations Prisma jouées au démarrage du conteneur.

Variables d'environnement : `DATABASE_URL`, `SESSION_SECRET`, `UPLOAD_DIR`,
`SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD` (utilisées au premier démarrage
uniquement, pour créer le compte initial).

Script `scripts/backup.sh` : sauvegarde cohérente de la base via
`sqlite3 .backup` plus archive des uploads, horodatée, avec rotation.

Le premier démarrage crée le super admin, les badges et le catalogue de tâches
types fourni.

## 16. Catalogue de tâches types fourni

Rangé par phase, modifiable et complétable par les chefs.

**Choisir** — recueillir les idées de chacun · présenter les idées à l'équipe ·
voter le projet · définir l'objectif du projet · identifier à qui le projet
profite · fixer les grandes dates.

**Agir** — établir le budget prévisionnel · chercher des financements · contacter
les partenaires · réserver le lieu · préparer le matériel · organiser le
transport · répartir les responsabilités · préparer la communication ·
rédiger le dossier de projet · vérifier les autorisations.

**Partager** — réaliser le reportage photo · préparer la veillée de partage ·
présenter le projet au groupe · remercier les partenaires · faire la relecture
du projet · évaluer ce qu'on a appris.

## 17. Décisions à retenir

1. **Grand livre de points plutôt que compteur** — historique auditable et réversible.
2. **Arrondi au supérieur sur les points partagés** — pas de reste perdu, coopération légèrement favorisée.
3. **Candidature plutôt qu'inscription directe sur un rôle** — un rôle unique demande un arbitrage.
4. **Refus jamais terminal** — la pédagogie du CAP, c'est corriger et recommencer.
5. **Photos réencodées, EXIF supprimées, servies derrière la session** — ce sont des mineurs.
6. **Aucune donnée personnelle stockée** — obligations RGPD réduites au minimum.
7. **Badges en base, pas en dur** — ajustables sans redéploiement.
8. **Machine à états centralisée** — aucune action ne modifie un statut directement.

## 18. Hors périmètre de la v1

Emails et notifications poussées · messagerie entre jeunes · calendrier et
rappels d'échéance · suivi budgétaire · export PDF du dossier de projet ·
multi-unités · application mobile native.

Chacun est ajoutable sans remettre en cause ce qui précède.
