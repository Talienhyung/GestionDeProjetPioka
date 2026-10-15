# Site de gestion de CAP Pionniers-Caravelles — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un site où les jeunes d'une caravane Pionniers-Caravelles s'inscrivent sur les tâches et les rôles de leur CAP, soumettent leur travail et gagnent points et badges, pendant que les chefs valident ou refusent depuis une file de validation.

**Architecture:** Application Next.js 15 monolithique. Toute la logique de décision vit dans `src/lib/domain` en fonctions pures, la logique de persistance dans `src/lib/services` en fonctions qui reçoivent explicitement un client Prisma et l'acteur courant, et les Server Actions ne font que lire la session, appeler une garde puis un service. Cette séparation est ce qui rend le cœur du produit testable sans navigateur ni serveur.

**Tech Stack:** TypeScript strict, Next.js 15 (App Router), React 19, Prisma 6 sur SQLite, Tailwind CSS 4, `@node-rs/argon2`, `sharp`, Vitest 3, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-cap-pionniers-design.md`

## Global Constraints

- Node.js 22 LTS. TypeScript en mode `strict`.
- Next.js 15 App Router, React 19, sortie `standalone` pour Docker.
- Prisma 6 sur SQLite. **Prisma ne supporte pas les `enum` sur SQLite** : tous les champs énumérés sont des `String` en base, typés par des unions TypeScript dans `src/lib/domain/types.ts`.
- Toute fonction de `src/lib/services` prend un client Prisma en premier paramètre (`db: PrismaClientOrTx`) et l'acteur en second quand elle en a besoin. Aucun service n'importe le singleton.
- Aucun fichier de `src/lib/domain` n'importe Prisma, `next/headers`, ni rien d'asynchrone.
- Barème par défaut : `FACILE 10 · MOYEN 25 · DIFFICILE 50`, surchargeable par la table `Setting` (clé `pointsScale`).
- Bonus plafonné au socle de la tâche. Points partagés = `Math.ceil(socle / nombre de participants) + bonus`.
- Photos : 3 maximum par soumission, 8 Mo maximum chacune, `image/jpeg`, `image/png`, `image/webp` uniquement, réencodées en WebP à 1600 px maximum sur le grand côté.
- Mots de passe en argon2id. Cookie de session `httpOnly`, `SameSite=Lax`, `Secure` en production, 30 jours glissants. 10 échecs de connexion par identifiant et par quart d'heure.
- Aucune donnée personnelle stockée : ni email, ni date de naissance, ni adresse.
- Interface entièrement en français, mobile-first.
- Un commit par tâche, message de commit en français.

## Review Focus

Les cinq classes d'entrées que la spec implique sans les décrire, les plus susceptibles de nuire à un utilisateur réel. Chacune a son test rattaché à la tâche qui possède le code concerné.

1. **Double validation d'une même soumission** (deux chefs cliquent en même temps, ou double-clic) : les points ne doivent être crédités qu'une fois. → Tâche 12, contrainte d'unicité `(userId, submissionId)` sur `PointsEntry` plus vérification de `decision` dans la transaction.
2. **Session encore valide d'un compte désactivé** : l'accès doit être refusé immédiatement, sans attendre l'expiration du cookie. → Tâche 7.
3. **Le nombre de participants change entre la soumission et la validation** (un chef retire quelqu'un) : le partage des points doit utiliser les participants présents au moment de la validation, et ne jamais diviser par zéro. → Tâche 12.
4. **Fichier hostile ou hors limites** : un `.jpg` qui n'est pas une image, un fichier de 20 Mo, une quatrième photo, un envoi vide. Chacun doit être refusé avec un message clair, jamais écrit sur le disque. → Tâche 10.
5. **Identifiant en doublon ou en casse différente** (`Jean` et `jean`) : la création doit être refusée, et la connexion ne doit pas dépendre de la casse. → Tâche 14.

## Structure des fichiers

```
src/
  app/
    (auth)/login/page.tsx                 formulaire de connexion
    (auth)/login/actions.ts
    (app)/layout.tsx                      coquille connectée (nav, thème)
    (app)/accueil/page.tsx
    (app)/cap/page.tsx                    tableau par phase
    (app)/cap/[taskId]/page.tsx           détail + fil des soumissions
    (app)/cap/[taskId]/actions.ts
    (app)/roles/page.tsx + actions.ts
    (app)/notifications/page.tsx
    (app)/classement/page.tsx
    (app)/profil/page.tsx + actions.ts
    (chef)/validation/page.tsx + actions.ts
    (chef)/taches/page.tsx + actions.ts
    (chef)/pilotage/page.tsx + actions.ts
    (chef)/membres/page.tsx + actions.ts
    (admin)/comptes/page.tsx + actions.ts
    (admin)/parametres/page.tsx + actions.ts
    api/fichiers/[id]/route.ts            service protégé des photos
  components/                             composants d'interface réutilisables
  lib/
    domain/types.ts      unions TypeScript de tous les champs énumérés
    domain/points.ts     calcul des points — pur
    domain/tasks.ts      machine à états des tâches — pur
    domain/badges.ts     moteur de règles des badges — pur
    domain/uploads.ts    règles de validation des photos — pur
    auth/password.ts     hachage, vérification, mot de passe provisoire
    auth/session.ts      création, lecture, destruction des sessions
    auth/throttle.ts     limitation des tentatives de connexion
    auth/guard.ts        requireUser / requireChef / requireSuperAdmin
    services/*.ts        accès base, un fichier par domaine fonctionnel
    storage.ts           écriture et lecture des photos sur le volume
    db.ts                singleton Prisma
prisma/schema.prisma · prisma/seed.ts
tests/helpers/db.ts · tests/unit/*.test.ts · tests/integration/*.test.ts
e2e/*.spec.ts
Dockerfile · docker-compose.yml · scripts/backup.sh
```

---

### Task 1: Socle du projet

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Test: `tests/unit/socle.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `pnpm test` (Vitest), `pnpm dev`, `pnpm build`. Alias d'import `@/` vers `src/`.

- [ ] **Step 1: Créer le projet Next.js**

```bash
cd /home/tan/dev/GestionDeProjetPioka
pnpm dlx create-next-app@15 . --ts --tailwind --app --src-dir --import-alias "@/*" --eslint --no-turbopack
```

Répondre « oui » à l'écrasement du dossier s'il le demande : le dépôt ne contient que `docs/`.

- [ ] **Step 2: Ajouter les dépendances de test**

```bash
pnpm add -D vitest@^3 @vitejs/plugin-react vite-tsconfig-paths @types/node
```

- [ ] **Step 3: Écrire `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    pool: 'forks',
  },
})
```

Le pool `forks` est nécessaire : les tests d'intégration créent chacun leur propre fichier SQLite et Prisma n'aime pas les threads partagés.

- [ ] **Step 4: Ajouter les scripts dans `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Écrire le test de fumée**

```ts
// tests/unit/socle.test.ts
import { describe, expect, it } from 'vitest'

describe('socle du projet', () => {
  it('exécute les tests TypeScript', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Lancer les tests**

Run: `pnpm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Écrire `.env.example`**

```bash
DATABASE_URL="file:./prisma/dev.db"
UPLOAD_DIR="./.uploads"
SUPER_ADMIN_USERNAME="admin"
SUPER_ADMIN_PASSWORD="changeme"
```

Copier en `.env` pour le développement local. Ajouter `.env`, `.uploads/` et `*.db` au `.gitignore`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: socle Next.js 15, Tailwind et Vitest"
```

---

### Task 2: Schéma Prisma et base de test

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/domain/types.ts`, `tests/helpers/db.ts`
- Test: `tests/integration/schema.test.ts`

**Interfaces:**
- Consumes: Tâche 1.
- Produces:
  - `db` : singleton `PrismaClient` exporté par `src/lib/db.ts`.
  - `createTestDb(): Promise<{ prisma: PrismaClient; cleanup: () => Promise<void> }>`.
  - Les unions de `src/lib/domain/types.ts`, utilisées par toutes les tâches suivantes.

- [ ] **Step 1: Installer Prisma**

```bash
pnpm add @prisma/client && pnpm add -D prisma
```

- [ ] **Step 2: Écrire `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id                 String   @id @default(cuid())
  username           String   @unique
  displayName        String
  passwordHash       String
  role               String
  mustChangePassword Boolean  @default(true)
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())

  sessions         Session[]
  assignments      TaskAssignment[]
  submissions      Submission[]      @relation("SubmissionAuthor")
  reviews          Submission[]      @relation("SubmissionReviewer")
  createdTasks     Task[]            @relation("TaskAuthor")
  rolesHeld        ProjectRole[]
  roleApplications RoleApplication[]
  badges           UserBadge[]
  pointsEntries    PointsEntry[]
  notifications    Notification[]
  attachments      Attachment[]
}

model Session {
  id        String   @id
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model Project {
  id            String        @id @default(cuid())
  title         String
  description   String        @default("")
  currentPhase  String        @default("CHOISIR")
  status        String        @default("EN_COURS")
  startedAt     DateTime      @default(now())
  archivedAt    DateTime?
  tasks         Task[]
  roles         ProjectRole[]
  pointsEntries PointsEntry[]
  userBadges    UserBadge[]
}

model Task {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title       String
  description String    @default("")
  phase       String
  difficulty  String
  status      String
  createdById String
  createdBy   User      @relation("TaskAuthor", fields: [createdById], references: [id])
  dueDate     DateTime?
  createdAt   DateTime  @default(now())

  assignments   TaskAssignment[]
  submissions   Submission[]
  pointsEntries PointsEntry[]

  @@index([projectId, status])
}

model TaskAssignment {
  id       String   @id @default(cuid())
  taskId   String
  task     Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId   String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt DateTime @default(now())

  @@unique([taskId, userId])
}

model Submission {
  id            String       @id @default(cuid())
  taskId        String
  task          Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  submittedById String
  submittedBy   User         @relation("SubmissionAuthor", fields: [submittedById], references: [id])
  message       String       @default("")
  createdAt     DateTime     @default(now())
  decision      String?
  reviewedById  String?
  reviewedBy    User?        @relation("SubmissionReviewer", fields: [reviewedById], references: [id])
  reviewedAt    DateTime?
  reviewComment String?
  bonusPoints   Int          @default(0)
  attachments   Attachment[]

  @@index([taskId])
}

model Attachment {
  id           String     @id @default(cuid())
  submissionId String
  submission   Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  storedName   String
  originalName String
  mimeType     String
  sizeBytes    Int
  width        Int
  height       Int
  uploadedById String
  uploadedBy   User       @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime   @default(now())
}

model ProjectRole {
  id           String            @id @default(cuid())
  projectId    String
  project      Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name         String
  description  String            @default("")
  points       Int
  holderId     String?
  holder       User?             @relation(fields: [holderId], references: [id])
  closedAt     DateTime?
  applications RoleApplication[]
}

model RoleApplication {
  id            String      @id @default(cuid())
  projectRoleId String
  projectRole   ProjectRole @relation(fields: [projectRoleId], references: [id], onDelete: Cascade)
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  status        String      @default("EN_ATTENTE")
  createdAt     DateTime    @default(now())
  decidedById   String?

  @@unique([projectRoleId, userId])
}

model TaskTemplate {
  id          String  @id @default(cuid())
  title       String
  description String  @default("")
  phase       String
  difficulty  String
  isBuiltin   Boolean @default(false)
  isArchived  Boolean @default(false)
}

model Badge {
  id          String      @id @default(cuid())
  code        String      @unique
  name        String
  description String
  icon        String
  ruleType    String
  threshold   Int         @default(1)
  points      Int         @default(0)
  sortOrder   Int         @default(0)
  userBadges  UserBadge[]
}

model UserBadge {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  badgeId   String
  badge     Badge    @relation(fields: [badgeId], references: [id], onDelete: Cascade)
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])
  earnedAt  DateTime @default(now())

  @@unique([userId, badgeId])
}

model PointsEntry {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  amount        Int
  reason        String
  taskId        String?
  task          Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  projectRoleId String?
  badgeId       String?
  submissionId  String?
  createdAt     DateTime @default(now())

  @@unique([userId, submissionId])
  @@index([userId])
  @@index([projectId])
}

model Notification {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String
  message   String
  link      String    @default("/accueil")
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, readAt])
}

model Setting {
  key   String @id
  value String
}
```

La contrainte `@@unique([userId, submissionId])` sur `PointsEntry` est la protection de dernier recours contre le double crédit de points (Review Focus 1). SQLite considère deux `NULL` comme distincts, donc elle ne gêne pas les lignes sans soumission.

- [ ] **Step 3: Écrire `src/lib/domain/types.ts`**

```ts
export const APP_ROLES = ['SUPER_ADMIN', 'CHEF', 'JEUNE'] as const
export type AppRole = (typeof APP_ROLES)[number]

export const PHASES = ['CHOISIR', 'AGIR', 'PARTAGER'] as const
export type Phase = (typeof PHASES)[number]

export const DIFFICULTIES = ['FACILE', 'MOYEN', 'DIFFICILE'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const PROJECT_STATUSES = ['BROUILLON', 'EN_COURS', 'ARCHIVE'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const TASK_STATUSES = [
  'PROPOSEE',
  'REJETEE',
  'OUVERTE',
  'EN_COURS',
  'SOUMISE',
  'A_CORRIGER',
  'TERMINEE',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const REVIEW_DECISIONS = ['ACCEPTEE', 'REFUSEE'] as const
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

export const ROLE_APPLICATION_STATUSES = ['EN_ATTENTE', 'ACCEPTEE', 'REFUSEE'] as const
export type RoleApplicationStatus = (typeof ROLE_APPLICATION_STATUSES)[number]

export const POINTS_REASONS = ['TACHE', 'BONUS', 'ROLE', 'BADGE', 'ANNULATION'] as const
export type PointsReason = (typeof POINTS_REASONS)[number]

export const PHASE_LABELS: Record<Phase, string> = {
  CHOISIR: 'Choisir',
  AGIR: 'Agir',
  PARTAGER: 'Partager',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
}

/** L'acteur courant, tel que les services le reçoivent. */
export interface Actor {
  id: string
  role: AppRole
  displayName: string
}

export function isChef(actor: Actor): boolean {
  return actor.role === 'CHEF' || actor.role === 'SUPER_ADMIN'
}
```

- [ ] **Step 4: Écrire `src/lib/db.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/** Client Prisma ou client de transaction : ce que les services acceptent. */
export type Db = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
```

- [ ] **Step 5: Écrire `tests/helpers/db.ts`**

```ts
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

export interface TestDb {
  prisma: PrismaClient
  cleanup: () => Promise<void>
}

/** Crée une base SQLite jetable, schéma appliqué, isolée par test. */
export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), 'cap-test-'))
  const url = `file:${join(dir, 'test.db')}`

  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  })

  const prisma = new PrismaClient({ datasourceUrl: url })

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
```

- [ ] **Step 6: Écrire le test d'intégration**

```ts
// tests/integration/schema.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../helpers/db'

describe('schéma', () => {
  let t: TestDb
  beforeAll(() => { t = createTestDb() })
  afterAll(async () => { await t.cleanup() })

  it('crée un jeune et refuse un identifiant en doublon', async () => {
    await t.prisma.user.create({
      data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' },
    })

    await expect(
      t.prisma.user.create({
        data: { username: 'lucie', displayName: 'Lucie B', passwordHash: 'x', role: 'JEUNE' },
      }),
    ).rejects.toThrow()
  })

  it('refuse deux lignes de points pour la même soumission et le même jeune', async () => {
    const user = await t.prisma.user.create({
      data: { username: 'tom', displayName: 'Tom', passwordHash: 'x', role: 'JEUNE' },
    })
    const project = await t.prisma.project.create({ data: { title: 'Camp 2027' } })
    const base = { userId: user.id, projectId: project.id, amount: 10, reason: 'TACHE', submissionId: 'sub-1' }

    await t.prisma.pointsEntry.create({ data: base })
    await expect(t.prisma.pointsEntry.create({ data: base })).rejects.toThrow()
  })
})
```

- [ ] **Step 7: Générer le client et lancer les tests**

```bash
cp .env.example .env
pnpm exec prisma generate
pnpm exec prisma migrate dev --name init
pnpm test
```

Expected: PASS, 3 tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: schéma de données et base de test jetable"
```

---

### Task 3: Calcul des points

**Files:**
- Create: `src/lib/domain/points.ts`
- Test: `tests/unit/points.test.ts`

**Interfaces:**
- Consumes: `Difficulty` de `@/lib/domain/types`.
- Produces:
  - `DEFAULT_SCALE: PointsScale`
  - `computeTaskAward(difficulty, participantCount, bonus, scale?): number`
  - `maxBonus(difficulty, scale?): number`
  - `parseScale(raw: string | null | undefined): PointsScale`

- [ ] **Step 1: Écrire les tests**

```ts
// tests/unit/points.test.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALE, computeTaskAward, maxBonus, parseScale } from '@/lib/domain/points'

describe('computeTaskAward', () => {
  it('donne le socle entier à un participant seul', () => {
    expect(computeTaskAward('FACILE', 1, 0)).toBe(10)
    expect(computeTaskAward('MOYEN', 1, 0)).toBe(25)
    expect(computeTaskAward('DIFFICILE', 1, 0)).toBe(50)
  })

  it('partage le socle en arrondissant au supérieur', () => {
    expect(computeTaskAward('MOYEN', 2, 0)).toBe(13)
    expect(computeTaskAward('MOYEN', 3, 0)).toBe(9)
    expect(computeTaskAward('FACILE', 4, 0)).toBe(3)
  })

  it('ajoute le bonus intégralement à chaque participant', () => {
    expect(computeTaskAward('MOYEN', 2, 5)).toBe(18)
  })

  it('plafonne le bonus au socle de la tâche', () => {
    expect(computeTaskAward('FACILE', 1, 999)).toBe(20)
    expect(maxBonus('FACILE')).toBe(10)
  })

  it('refuse un bonus négatif et un nombre de participants invalide', () => {
    expect(() => computeTaskAward('FACILE', 1, -1)).toThrow(/bonus/i)
    expect(() => computeTaskAward('FACILE', 0, 0)).toThrow(/participant/i)
  })

  it('respecte un barème personnalisé', () => {
    expect(computeTaskAward('FACILE', 2, 0, { FACILE: 7, MOYEN: 20, DIFFICILE: 40 })).toBe(4)
  })
})

describe('parseScale', () => {
  it('rend le barème par défaut si le réglage est absent ou illisible', () => {
    expect(parseScale(null)).toEqual(DEFAULT_SCALE)
    expect(parseScale('pas du json')).toEqual(DEFAULT_SCALE)
    expect(parseScale('{"FACILE": 5}')).toEqual(DEFAULT_SCALE)
  })

  it('lit un barème complet et valide', () => {
    expect(parseScale('{"FACILE":5,"MOYEN":15,"DIFFICILE":30}')).toEqual({
      FACILE: 5, MOYEN: 15, DIFFICILE: 30,
    })
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm test tests/unit/points.test.ts`
Expected: FAIL — `Cannot find module '@/lib/domain/points'`.

- [ ] **Step 3: Écrire l'implémentation**

```ts
// src/lib/domain/points.ts
import { DIFFICULTIES, type Difficulty } from './types'

export type PointsScale = Record<Difficulty, number>

export const DEFAULT_SCALE: PointsScale = { FACILE: 10, MOYEN: 25, DIFFICILE: 50 }

export function maxBonus(difficulty: Difficulty, scale: PointsScale = DEFAULT_SCALE): number {
  return scale[difficulty]
}

/**
 * Points gagnés par CHAQUE participant d'une tâche validée.
 * Le socle est partagé, arrondi au supérieur ; le bonus s'applique à chacun.
 */
export function computeTaskAward(
  difficulty: Difficulty,
  participantCount: number,
  bonus: number,
  scale: PointsScale = DEFAULT_SCALE,
): number {
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw new Error('Le nombre de participants doit être un entier supérieur ou égal à 1.')
  }
  if (!Number.isFinite(bonus) || bonus < 0) {
    throw new Error('Le bonus ne peut pas être négatif.')
  }

  const base = scale[difficulty]
  const share = Math.ceil(base / participantCount)
  return share + Math.min(Math.round(bonus), maxBonus(difficulty, scale))
}

export function parseScale(raw: string | null | undefined): PointsScale {
  if (!raw) return DEFAULT_SCALE
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SCALE
    const candidate = parsed as Record<string, unknown>
    const complete = DIFFICULTIES.every(
      (d) => typeof candidate[d] === 'number' && Number.isInteger(candidate[d]) && (candidate[d] as number) > 0,
    )
    if (!complete) return DEFAULT_SCALE
    return {
      FACILE: candidate.FACILE as number,
      MOYEN: candidate.MOYEN as number,
      DIFFICILE: candidate.DIFFICILE as number,
    }
  } catch {
    return DEFAULT_SCALE
  }
}
```

- [ ] **Step 4: Lancer les tests**

Run: `pnpm test tests/unit/points.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/points.ts tests/unit/points.test.ts
git commit -m "feat: calcul des points partagés et du bonus plafonné"
```

---

### Task 4: Machine à états des tâches

**Files:**
- Create: `src/lib/domain/tasks.ts`
- Test: `tests/unit/tasks.test.ts`

**Interfaces:**
- Consumes: `TaskStatus`, `Actor`, `isChef` de `@/lib/domain/types`.
- Produces:
  - `type TaskAction`
  - `interface TaskContext`
  - `canPerform(ctx: TaskContext, action: TaskAction): boolean`
  - `nextStatus(ctx: TaskContext, action: TaskAction): TaskStatus` — lève `TaskTransitionError`
  - `class TaskTransitionError extends Error`

- [ ] **Step 1: Écrire les tests**

```ts
// tests/unit/tasks.test.ts
import { describe, expect, it } from 'vitest'
import { TaskTransitionError, canPerform, nextStatus, type TaskContext } from '@/lib/domain/tasks'

const base: TaskContext = {
  status: 'OUVERTE',
  participantCount: 0,
  hasSubmission: false,
  projectArchived: false,
  isParticipant: false,
  actorRole: 'JEUNE',
}

const ctx = (over: Partial<TaskContext> = {}): TaskContext => ({ ...base, ...over })

describe('inscription', () => {
  it('fait passer une tâche ouverte en cours', () => {
    expect(nextStatus(ctx(), 'S_INSCRIRE')).toBe('EN_COURS')
  })

  it('laisse en cours une tâche qui a déjà des participants', () => {
    expect(nextStatus(ctx({ status: 'EN_COURS', participantCount: 1 }), 'S_INSCRIRE')).toBe('EN_COURS')
  })

  it('refuse de s inscrire sur une tâche terminée ou soumise', () => {
    expect(canPerform(ctx({ status: 'TERMINEE' }), 'S_INSCRIRE')).toBe(false)
    expect(canPerform(ctx({ status: 'SOUMISE', participantCount: 1 }), 'S_INSCRIRE')).toBe(false)
  })

  it('autorise à reprendre une tâche à corriger', () => {
    expect(canPerform(ctx({ status: 'A_CORRIGER', participantCount: 1 }), 'S_INSCRIRE')).toBe(true)
  })
})

describe('désinscription', () => {
  it('rouvre la tâche quand le dernier participant part', () => {
    expect(nextStatus(ctx({ status: 'EN_COURS', participantCount: 1, isParticipant: true }), 'SE_DESINSCRIRE'))
      .toBe('OUVERTE')
  })

  it('garde la tâche en cours s il reste des participants', () => {
    expect(nextStatus(ctx({ status: 'EN_COURS', participantCount: 3, isParticipant: true }), 'SE_DESINSCRIRE'))
      .toBe('EN_COURS')
  })

  it('refuse la désinscription dès qu une soumission existe', () => {
    const c = ctx({ status: 'A_CORRIGER', participantCount: 2, isParticipant: true, hasSubmission: true })
    expect(canPerform(c, 'SE_DESINSCRIRE')).toBe(false)
  })

  it('refuse la désinscription à qui n est pas participant', () => {
    expect(canPerform(ctx({ status: 'EN_COURS', participantCount: 1 }), 'SE_DESINSCRIRE')).toBe(false)
  })

  it('laisse un chef retirer un participant même après soumission', () => {
    const c = ctx({ status: 'SOUMISE', participantCount: 2, hasSubmission: true, actorRole: 'CHEF' })
    expect(nextStatus(c, 'RETIRER_PARTICIPANT')).toBe('SOUMISE')
  })
})

describe('soumission et revue', () => {
  it('soumet une tâche en cours', () => {
    expect(nextStatus(ctx({ status: 'EN_COURS', participantCount: 1, isParticipant: true }), 'SOUMETTRE'))
      .toBe('SOUMISE')
  })

  it('resoumet une tâche à corriger', () => {
    const c = ctx({ status: 'A_CORRIGER', participantCount: 1, isParticipant: true, hasSubmission: true })
    expect(nextStatus(c, 'SOUMETTRE')).toBe('SOUMISE')
  })

  it('refuse la soumission par un non participant', () => {
    expect(canPerform(ctx({ status: 'EN_COURS', participantCount: 1 }), 'SOUMETTRE')).toBe(false)
  })

  it('valide et refuse une soumission, réservé aux chefs', () => {
    const c = ctx({ status: 'SOUMISE', participantCount: 1, hasSubmission: true, actorRole: 'CHEF' })
    expect(nextStatus(c, 'VALIDER')).toBe('TERMINEE')
    expect(nextStatus(c, 'REFUSER')).toBe('A_CORRIGER')
    expect(canPerform({ ...c, actorRole: 'JEUNE' }, 'VALIDER')).toBe(false)
  })

  it('permet à un chef d annuler une validation', () => {
    const c = ctx({ status: 'TERMINEE', participantCount: 1, hasSubmission: true, actorRole: 'CHEF' })
    expect(nextStatus(c, 'ANNULER_VALIDATION')).toBe('A_CORRIGER')
  })
})

describe('propositions', () => {
  it('accepte et refuse une proposition, réservé aux chefs', () => {
    const c = ctx({ status: 'PROPOSEE', actorRole: 'CHEF' })
    expect(nextStatus(c, 'ACCEPTER_PROPOSITION')).toBe('OUVERTE')
    expect(nextStatus(c, 'REFUSER_PROPOSITION')).toBe('REJETEE')
    expect(canPerform({ ...c, actorRole: 'JEUNE' }, 'ACCEPTER_PROPOSITION')).toBe(false)
  })

  it('refuse toute inscription sur une tâche encore proposée', () => {
    expect(canPerform(ctx({ status: 'PROPOSEE' }), 'S_INSCRIRE')).toBe(false)
  })
})

describe('projet archivé', () => {
  it('interdit toute action, y compris aux chefs', () => {
    const c = ctx({ status: 'OUVERTE', projectArchived: true, actorRole: 'CHEF' })
    expect(canPerform(c, 'S_INSCRIRE')).toBe(false)
    expect(canPerform(c, 'VALIDER')).toBe(false)
    expect(() => nextStatus(c, 'S_INSCRIRE')).toThrow(TaskTransitionError)
  })
})

describe('nextStatus', () => {
  it('lève une erreur explicite sur une transition interdite', () => {
    expect(() => nextStatus(ctx({ status: 'TERMINEE' }), 'SOUMETTRE')).toThrow(TaskTransitionError)
    expect(() => nextStatus(ctx({ status: 'TERMINEE' }), 'SOUMETTRE')).toThrow(/TERMINEE/)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm test tests/unit/tasks.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire l'implémentation**

```ts
// src/lib/domain/tasks.ts
import type { AppRole, TaskStatus } from './types'

export const TASK_ACTIONS = [
  'ACCEPTER_PROPOSITION',
  'REFUSER_PROPOSITION',
  'S_INSCRIRE',
  'SE_DESINSCRIRE',
  'RETIRER_PARTICIPANT',
  'SOUMETTRE',
  'VALIDER',
  'REFUSER',
  'ANNULER_VALIDATION',
] as const
export type TaskAction = (typeof TASK_ACTIONS)[number]

export interface TaskContext {
  status: TaskStatus
  /** Participants inscrits AVANT l'action. */
  participantCount: number
  /** Au moins une soumission a déjà été faite sur cette tâche. */
  hasSubmission: boolean
  projectArchived: boolean
  /** L'acteur est inscrit sur la tâche. */
  isParticipant: boolean
  actorRole: AppRole
}

export class TaskTransitionError extends Error {
  constructor(status: TaskStatus, action: TaskAction, reason: string) {
    super(`Action « ${action} » impossible sur une tâche ${status} : ${reason}`)
    this.name = 'TaskTransitionError'
  }
}

const CHEF_ACTIONS: TaskAction[] = [
  'ACCEPTER_PROPOSITION',
  'REFUSER_PROPOSITION',
  'RETIRER_PARTICIPANT',
  'VALIDER',
  'REFUSER',
  'ANNULER_VALIDATION',
]

function actorIsChef(ctx: TaskContext): boolean {
  return ctx.actorRole === 'CHEF' || ctx.actorRole === 'SUPER_ADMIN'
}

/** Rend le statut résultant, ou null si l'action est interdite dans ce contexte. */
function resolve(ctx: TaskContext, action: TaskAction): TaskStatus | null {
  if (ctx.projectArchived) return null
  if (CHEF_ACTIONS.includes(action) && !actorIsChef(ctx)) return null

  switch (action) {
    case 'ACCEPTER_PROPOSITION':
      return ctx.status === 'PROPOSEE' ? 'OUVERTE' : null

    case 'REFUSER_PROPOSITION':
      return ctx.status === 'PROPOSEE' ? 'REJETEE' : null

    case 'S_INSCRIRE':
      if (ctx.isParticipant) return null
      return ['OUVERTE', 'EN_COURS', 'A_CORRIGER'].includes(ctx.status) ? ctx.status === 'OUVERTE' ? 'EN_COURS' : ctx.status : null

    case 'SE_DESINSCRIRE':
      if (!ctx.isParticipant || ctx.hasSubmission) return null
      if (!['EN_COURS', 'OUVERTE'].includes(ctx.status)) return null
      return ctx.participantCount <= 1 ? 'OUVERTE' : 'EN_COURS'

    case 'RETIRER_PARTICIPANT':
      if (ctx.status === 'TERMINEE' || ctx.participantCount < 1) return null
      if (!ctx.hasSubmission && ctx.participantCount <= 1) return 'OUVERTE'
      return ctx.status

    case 'SOUMETTRE':
      if (!ctx.isParticipant) return null
      return ['EN_COURS', 'A_CORRIGER'].includes(ctx.status) ? 'SOUMISE' : null

    case 'VALIDER':
      return ctx.status === 'SOUMISE' ? 'TERMINEE' : null

    case 'REFUSER':
      return ctx.status === 'SOUMISE' ? 'A_CORRIGER' : null

    case 'ANNULER_VALIDATION':
      return ctx.status === 'TERMINEE' ? 'A_CORRIGER' : null
  }
}

export function canPerform(ctx: TaskContext, action: TaskAction): boolean {
  return resolve(ctx, action) !== null
}

export function nextStatus(ctx: TaskContext, action: TaskAction): TaskStatus {
  const result = resolve(ctx, action)
  if (result === null) {
    const reason = ctx.projectArchived
      ? 'le CAP est archivé'
      : CHEF_ACTIONS.includes(action) && !actorIsChef(ctx)
        ? 'réservé aux chefs'
        : 'transition non autorisée'
    throw new TaskTransitionError(ctx.status, action, reason)
  }
  return result
}
```

- [ ] **Step 4: Lancer les tests**

Run: `pnpm test tests/unit/tasks.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/tasks.ts tests/unit/tasks.test.ts
git commit -m "feat: machine à états des tâches"
```

---

### Task 5: Moteur de badges

**Files:**
- Create: `src/lib/domain/badges.ts`
- Test: `tests/unit/badges.test.ts`

**Interfaces:**
- Consumes: `Phase` de `@/lib/domain/types`.
- Produces:
  - `type BadgeRuleType`, `interface BadgeRule`, `interface UserStats`, `emptyStats(): UserStats`
  - `measure(ruleType: BadgeRuleType, stats: UserStats): number`
  - `evaluateBadges(rules: BadgeRule[], stats: UserStats, earnedCodes: string[]): string[]`

- [ ] **Step 1: Écrire les tests**

```ts
// tests/unit/badges.test.ts
import { describe, expect, it } from 'vitest'
import { type BadgeRule, type UserStats, emptyStats, evaluateBadges, measure } from '@/lib/domain/badges'

const RULES: BadgeRule[] = [
  { code: 'premier_pas', ruleType: 'TACHES_VALIDEES', threshold: 1 },
  { code: 'bosseur_1', ruleType: 'TACHES_VALIDEES', threshold: 5 },
  { code: 'costaud', ruleType: 'TACHE_DIFFICILE', threshold: 1 },
  { code: 'equipe', ruleType: 'TACHES_EN_EQUIPE', threshold: 5 },
  { code: 'debut_fin', ruleType: 'TOUTES_PHASES', threshold: 3 },
  { code: 'sans_faute', ruleType: 'SERIE_SANS_REFUS', threshold: 3 },
  { code: 'responsable', ruleType: 'ROLE_CLOTURE', threshold: 1 },
  { code: 'photographe', ruleType: 'SOUMISSIONS_AVEC_PHOTO', threshold: 5 },
]

const stats = (over: Partial<UserStats> = {}): UserStats => ({ ...emptyStats(), ...over })

describe('evaluateBadges', () => {
  it('ne donne rien à un jeune qui démarre', () => {
    expect(evaluateBadges(RULES, emptyStats(), [])).toEqual([])
  })

  it('donne le premier pas dès la première tâche validée', () => {
    expect(evaluateBadges(RULES, stats({ validatedTaskCount: 1 }), [])).toEqual(['premier_pas'])
  })

  it('donne les deux paliers d un coup si le seuil supérieur est franchi', () => {
    expect(evaluateBadges(RULES, stats({ validatedTaskCount: 6 }), [])).toEqual(['premier_pas', 'bosseur_1'])
  })

  it('ignore les badges déjà obtenus', () => {
    expect(evaluateBadges(RULES, stats({ validatedTaskCount: 6 }), ['premier_pas'])).toEqual(['bosseur_1'])
  })

  it('donne du début à la fin uniquement si les 3 phases sont couvertes sur un MÊME projet', () => {
    const deuxProjets = stats({
      validatedTaskCount: 3,
      phasesByProject: { p1: ['CHOISIR', 'AGIR'], p2: ['PARTAGER'] },
    })
    expect(evaluateBadges(RULES, deuxProjets, ['premier_pas'])).toEqual([])

    const unSeul = stats({
      validatedTaskCount: 3,
      phasesByProject: { p1: ['CHOISIR', 'AGIR', 'PARTAGER'] },
    })
    expect(evaluateBadges(RULES, unSeul, ['premier_pas'])).toEqual(['debut_fin'])
  })

  it('ne compte pas deux fois la même phase', () => {
    const s = stats({ phasesByProject: { p1: ['AGIR', 'AGIR', 'AGIR'] } })
    expect(measure('TOUTES_PHASES', s)).toBe(1)
  })

  it('donne costaud, esprit d équipe, sans faute, responsable et photographe au bon seuil', () => {
    const s = stats({
      validatedTaskCount: 5,
      hardValidatedTaskCount: 1,
      teamValidatedTaskCount: 5,
      cleanStreak: 3,
      closedRoleCount: 1,
      photoSubmissionCount: 5,
    })
    expect(evaluateBadges(RULES, s, [])).toEqual([
      'premier_pas', 'bosseur_1', 'costaud', 'equipe', 'sans_faute', 'responsable', 'photographe',
    ])
  })

  it('ignore une règle de type inconnu plutôt que de planter', () => {
    const rules = [{ code: 'mystere', ruleType: 'INEXISTANT' as never, threshold: 1 }]
    expect(evaluateBadges(rules, stats({ validatedTaskCount: 99 }), [])).toEqual([])
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm test tests/unit/badges.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire l'implémentation**

```ts
// src/lib/domain/badges.ts
import type { Phase } from './types'

export const BADGE_RULE_TYPES = [
  'TACHES_VALIDEES',
  'TACHE_DIFFICILE',
  'TACHES_EN_EQUIPE',
  'TOUTES_PHASES',
  'SERIE_SANS_REFUS',
  'ROLE_CLOTURE',
  'SOUMISSIONS_AVEC_PHOTO',
] as const
export type BadgeRuleType = (typeof BADGE_RULE_TYPES)[number]

export interface BadgeRule {
  code: string
  ruleType: BadgeRuleType
  threshold: number
}

export interface UserStats {
  validatedTaskCount: number
  hardValidatedTaskCount: number
  /** Tâches validées comptant au moins deux participants. */
  teamValidatedTaskCount: number
  /** Phases couvertes par des tâches validées, projet par projet. */
  phasesByProject: Record<string, Phase[]>
  /** Validations consécutives sans aucun refus intercalé. */
  cleanStreak: number
  closedRoleCount: number
  photoSubmissionCount: number
}

export function emptyStats(): UserStats {
  return {
    validatedTaskCount: 0,
    hardValidatedTaskCount: 0,
    teamValidatedTaskCount: 0,
    phasesByProject: {},
    cleanStreak: 0,
    closedRoleCount: 0,
    photoSubmissionCount: 0,
  }
}

/** Valeur mesurée pour une règle, à comparer à son seuil. */
export function measure(ruleType: BadgeRuleType, stats: UserStats): number {
  switch (ruleType) {
    case 'TACHES_VALIDEES':
      return stats.validatedTaskCount
    case 'TACHE_DIFFICILE':
      return stats.hardValidatedTaskCount
    case 'TACHES_EN_EQUIPE':
      return stats.teamValidatedTaskCount
    case 'TOUTES_PHASES':
      return Math.max(0, ...Object.values(stats.phasesByProject).map((p) => new Set(p).size))
    case 'SERIE_SANS_REFUS':
      return stats.cleanStreak
    case 'ROLE_CLOTURE':
      return stats.closedRoleCount
    case 'SOUMISSIONS_AVEC_PHOTO':
      return stats.photoSubmissionCount
    default:
      return 0
  }
}

/** Codes des badges mérités et pas encore obtenus, dans l'ordre des règles reçues. */
export function evaluateBadges(rules: BadgeRule[], stats: UserStats, earnedCodes: string[]): string[] {
  const earned = new Set(earnedCodes)
  return rules
    .filter((rule) => !earned.has(rule.code))
    .filter((rule) => BADGE_RULE_TYPES.includes(rule.ruleType) && measure(rule.ruleType, stats) >= rule.threshold)
    .map((rule) => rule.code)
}
```

`Math.max(0, ...[])` rend `0` : un jeune sans aucune tâche validée ne déclenche pas la règle des phases.

- [ ] **Step 4: Lancer les tests**

Run: `pnpm test tests/unit/badges.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/badges.ts tests/unit/badges.test.ts
git commit -m "feat: moteur de règles des badges"
```

---

### Task 6: Mots de passe et limitation des tentatives

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/throttle.ts`
- Test: `tests/unit/password.test.ts`, `tests/unit/throttle.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(stored: string, plain: string): Promise<boolean>`
  - `generateTempPassword(): string`
  - `assertPasswordAcceptable(plain: string): void` — lève `WeakPasswordError`
  - `loginThrottle` : instance partagée de `LoginThrottle`

- [ ] **Step 1: Installer argon2**

```bash
pnpm add @node-rs/argon2
```

`@node-rs/argon2` embarque des binaires précompilés : pas de compilation C dans l'image Docker, contrairement au paquet `argon2`.

- [ ] **Step 2: Écrire les tests des mots de passe**

```ts
// tests/unit/password.test.ts
import { describe, expect, it } from 'vitest'
import {
  WeakPasswordError,
  assertPasswordAcceptable,
  generateTempPassword,
  hashPassword,
  verifyPassword,
} from '@/lib/auth/password'

describe('hachage', () => {
  it('produit un hash argon2id vérifiable', async () => {
    const stored = await hashPassword('jeudi-scout-42')
    expect(stored.startsWith('$argon2id$')).toBe(true)
    expect(await verifyPassword(stored, 'jeudi-scout-42')).toBe(true)
  })

  it('rejette un mauvais mot de passe', async () => {
    const stored = await hashPassword('jeudi-scout-42')
    expect(await verifyPassword(stored, 'jeudi-scout-43')).toBe(false)
  })

  it('produit deux hashs différents pour le même mot de passe', async () => {
    expect(await hashPassword('identique')).not.toBe(await hashPassword('identique'))
  })

  it('rend false sans lever si le hash stocké est corrompu', async () => {
    expect(await verifyPassword('pas-un-hash', 'peu importe')).toBe(false)
  })
})

describe('assertPasswordAcceptable', () => {
  it('accepte un mot de passe de 8 caractères ou plus', () => {
    expect(() => assertPasswordAcceptable('12345678')).not.toThrow()
  })

  it('refuse un mot de passe trop court ou vide', () => {
    expect(() => assertPasswordAcceptable('court')).toThrow(WeakPasswordError)
    expect(() => assertPasswordAcceptable('   ')).toThrow(WeakPasswordError)
  })
})

describe('generateTempPassword', () => {
  it('produit un mot de passe lisible, différent à chaque appel', () => {
    const a = generateTempPassword()
    const b = generateTempPassword()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(10)
    expect(a).not.toMatch(/[O0lI1]/)
    expect(() => assertPasswordAcceptable(a)).not.toThrow()
  })
})
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm test tests/unit/password.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 4: Écrire `src/lib/auth/password.ts`**

```ts
import { randomInt } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'

export const MIN_PASSWORD_LENGTH = 8

export class WeakPasswordError extends Error {
  constructor() {
    super(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`)
    this.name = 'WeakPasswordError'
  }
}

export function assertPasswordAcceptable(plain: string): void {
  if (plain.trim().length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError()
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { algorithm: 2 /* argon2id */ })
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain)
  } catch {
    return false
  }
}

/** Alphabet sans caractères ambigus : un chef dicte ce mot de passe à l'oral. */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export function generateTempPassword(): string {
  let out = ''
  for (let i = 0; i < 12; i += 1) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}
```

- [ ] **Step 5: Écrire les tests de la limitation**

```ts
// tests/unit/throttle.test.ts
import { describe, expect, it } from 'vitest'
import { LoginThrottle } from '@/lib/auth/throttle'

describe('LoginThrottle', () => {
  it('laisse passer tant que le quota n est pas atteint', () => {
    const t = new LoginThrottle(3, 60_000)
    t.registerFailure('lucie', 0)
    t.registerFailure('lucie', 1_000)
    expect(t.isBlocked('lucie', 2_000)).toBe(false)
  })

  it('bloque au delà du quota dans la fenêtre', () => {
    const t = new LoginThrottle(3, 60_000)
    for (let i = 0; i < 3; i += 1) t.registerFailure('lucie', i * 1_000)
    expect(t.isBlocked('lucie', 4_000)).toBe(true)
  })

  it('oublie les échecs sortis de la fenêtre', () => {
    const t = new LoginThrottle(3, 60_000)
    for (let i = 0; i < 3; i += 1) t.registerFailure('lucie', i * 1_000)
    expect(t.isBlocked('lucie', 120_000)).toBe(false)
  })

  it('ignore la casse de l identifiant', () => {
    const t = new LoginThrottle(2, 60_000)
    t.registerFailure('Lucie', 0)
    t.registerFailure('LUCIE', 10)
    expect(t.isBlocked('lucie', 20)).toBe(true)
  })

  it('remet le compteur à zéro après une connexion réussie', () => {
    const t = new LoginThrottle(2, 60_000)
    t.registerFailure('lucie', 0)
    t.reset('lucie')
    t.registerFailure('lucie', 10)
    expect(t.isBlocked('lucie', 20)).toBe(false)
  })

  it('ne bloque pas les autres comptes', () => {
    const t = new LoginThrottle(1, 60_000)
    t.registerFailure('lucie', 0)
    expect(t.isBlocked('tom', 10)).toBe(false)
  })
})
```

- [ ] **Step 6: Écrire `src/lib/auth/throttle.ts`**

```ts
export const MAX_LOGIN_ATTEMPTS = 10
export const LOGIN_WINDOW_MS = 15 * 60 * 1000

/**
 * Limitation en mémoire des tentatives de connexion.
 * L'application tourne dans un conteneur unique : un redémarrage remet les
 * compteurs à zéro, ce qui est acceptable pour une caravane.
 */
export class LoginThrottle {
  private failures = new Map<string, number[]>()

  constructor(
    private readonly maxAttempts = MAX_LOGIN_ATTEMPTS,
    private readonly windowMs = LOGIN_WINDOW_MS,
  ) {}

  private key(username: string): string {
    return username.trim().toLowerCase()
  }

  private recent(username: string, now: number): number[] {
    const all = this.failures.get(this.key(username)) ?? []
    return all.filter((at) => now - at < this.windowMs)
  }

  registerFailure(username: string, now: number = Date.now()): void {
    this.failures.set(this.key(username), [...this.recent(username, now), now])
  }

  isBlocked(username: string, now: number = Date.now()): boolean {
    return this.recent(username, now).length >= this.maxAttempts
  }

  reset(username: string): void {
    this.failures.delete(this.key(username))
  }
}

export const loginThrottle = new LoginThrottle()
```

- [ ] **Step 7: Lancer les tests**

Run: `pnpm test tests/unit/password.test.ts tests/unit/throttle.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth tests/unit/password.test.ts tests/unit/throttle.test.ts
git commit -m "feat: hachage argon2id et limitation des tentatives de connexion"
```

---

### Task 7: Sessions et gardes d'autorisation

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/auth/guard.ts`
- Test: `tests/integration/session.test.ts`

**Interfaces:**
- Consumes: `Db` de `@/lib/db`, `Actor` de `@/lib/domain/types`.
- Produces:
  - `SESSION_COOKIE`, `SESSION_TTL_MS`
  - `createSession(db, userId): Promise<{ token: string; expiresAt: Date }>`
  - `readSession(db, token): Promise<SessionUser | null>`
  - `destroySession(db, token): Promise<void>` et `destroyUserSessions(db, userId): Promise<void>`
  - `getCurrentUser(): Promise<SessionUser | null>`, `requireUser()`, `requireChef()`, `requireSuperAdmin()` — ces quatre-là lisent le cookie et redirigent.
  - `interface SessionUser extends Actor { mustChangePassword: boolean }`

- [ ] **Step 1: Écrire le test d'intégration**

```ts
// tests/integration/session.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSession, destroySession, destroyUserSessions, readSession } from '@/lib/auth/session'
import { createTestDb, type TestDb } from '../helpers/db'

describe('sessions', () => {
  let t: TestDb
  let userId: string

  beforeAll(async () => {
    t = createTestDb()
    const user = await t.prisma.user.create({
      data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE', mustChangePassword: false },
    })
    userId = user.id
  })
  afterAll(async () => { await t.cleanup() })

  it('crée une session lisible et rend l acteur', async () => {
    const { token } = await createSession(t.prisma, userId)
    const session = await readSession(t.prisma, token)
    expect(session).toMatchObject({ id: userId, role: 'JEUNE', displayName: 'Lucie', mustChangePassword: false })
  })

  it('ne stocke jamais le jeton en clair', async () => {
    const { token } = await createSession(t.prisma, userId)
    expect(await t.prisma.session.findUnique({ where: { id: token } })).toBeNull()
  })

  it('rend null sur un jeton inconnu', async () => {
    expect(await readSession(t.prisma, 'jeton-inventé')).toBeNull()
  })

  it('rend null et supprime la session expirée', async () => {
    const { token } = await createSession(t.prisma, userId)
    const { id } = { id: (await t.prisma.session.findFirst({ orderBy: { createdAt: 'desc' } }))!.id }
    await t.prisma.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1_000) } })

    expect(await readSession(t.prisma, token)).toBeNull()
    expect(await t.prisma.session.findUnique({ where: { id } })).toBeNull()
  })

  // Review Focus 2
  it('refuse immédiatement la session d un compte désactivé', async () => {
    const { token } = await createSession(t.prisma, userId)
    await t.prisma.user.update({ where: { id: userId }, data: { isActive: false } })

    expect(await readSession(t.prisma, token)).toBeNull()

    await t.prisma.user.update({ where: { id: userId }, data: { isActive: true } })
  })

  it('prolonge une session qui approche de son terme', async () => {
    const { token } = await createSession(t.prisma, userId)
    const before = (await t.prisma.session.findFirst({ orderBy: { createdAt: 'desc' } }))!
    await t.prisma.session.update({
      where: { id: before.id },
      data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    })

    await readSession(t.prisma, token)

    const after = (await t.prisma.session.findUnique({ where: { id: before.id } }))!
    expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now() + 20 * 24 * 60 * 60 * 1000)
  })

  it('détruit une session, et toutes celles d un jeune', async () => {
    const a = await createSession(t.prisma, userId)
    await destroySession(t.prisma, a.token)
    expect(await readSession(t.prisma, a.token)).toBeNull()

    const b = await createSession(t.prisma, userId)
    const c = await createSession(t.prisma, userId)
    await destroyUserSessions(t.prisma, userId)
    expect(await readSession(t.prisma, b.token)).toBeNull()
    expect(await readSession(t.prisma, c.token)).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm test tests/integration/session.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `src/lib/auth/session.ts`**

```ts
import { createHash, randomBytes } from 'node:crypto'
import type { Db } from '@/lib/db'
import type { Actor, AppRole } from '@/lib/domain/types'

export const SESSION_COOKIE = 'cap_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** En deçà de ce reste, la session est prolongée à la lecture (fenêtre glissante). */
const RENEW_BELOW_MS = 25 * 24 * 60 * 60 * 1000

export interface SessionUser extends Actor {
  mustChangePassword: boolean
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } })
  return { token, expiresAt }
}

export async function readSession(db: Db, token: string): Promise<SessionUser | null> {
  if (!token) return null
  const id = hashToken(token)
  const session = await db.session.findUnique({ where: { id }, include: { user: true } })
  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id } }).catch(() => undefined)
    return null
  }

  // Un compte désactivé perd l'accès à la seconde, sans attendre l'expiration.
  if (!session.user.isActive) return null

  if (session.expiresAt.getTime() - Date.now() < RENEW_BELOW_MS) {
    await db.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } })
  }

  return {
    id: session.user.id,
    role: session.user.role as AppRole,
    displayName: session.user.displayName,
    mustChangePassword: session.user.mustChangePassword,
  }
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.session.delete({ where: { id: hashToken(token) } }).catch(() => undefined)
}

export async function destroyUserSessions(db: Db, userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } })
}
```

- [ ] **Step 4: Écrire `src/lib/auth/guard.ts`**

```ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { isChef } from '@/lib/domain/types'
import { SESSION_COOKIE, readSession, type SessionUser } from './session'

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return readSession(db, token)
}

/** Session valide exigée. Un changement de mot de passe en attente détourne vers le profil. */
export async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.mustChangePassword && !options.allowPasswordChange) redirect('/profil/mot-de-passe')
  return user
}

export async function requireChef(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isChef(user)) redirect('/accueil')
  return user
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'SUPER_ADMIN') redirect('/accueil')
  return user
}
```

`guard.ts` est volontairement sans logique : il lit le cookie, appelle `readSession` et redirige. Tout ce qui se teste est dans `session.ts`.

- [ ] **Step 5: Lancer les tests**

Run: `pnpm test tests/integration/session.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth tests/integration/session.test.ts
git commit -m "feat: sessions en base et gardes d'autorisation"
```

---

### Task 8: Grand livre des points et notifications

**Files:**
- Create: `src/lib/services/pointsService.ts`, `src/lib/services/notificationService.ts`
- Test: `tests/integration/points.test.ts`

**Interfaces:**
- Consumes: `Db`, `PointsReason`.
- Produces:
  - `creditPoints(db, input: PointsInput): Promise<void>` — lève `DuplicateAwardError` si la paire `(userId, submissionId)` existe déjà
  - `getScore(db, userId, projectId?): Promise<number>`
  - `getLedger(db, userId, projectId?): Promise<LedgerLine[]>`
  - `getLeaderboard(db, projectId): Promise<LeaderboardRow[]>`
  - `notify(db, userId, input): Promise<void>`, `notifyMany(db, userIds, input)`, `countUnread(db, userId)`, `listNotifications(db, userId, limit?)`, `markAllRead(db, userId)`

- [ ] **Step 1: Écrire le test d'intégration**

```ts
// tests/integration/points.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DuplicateAwardError, creditPoints, getLeaderboard, getLedger, getScore } from '@/lib/services/pointsService'
import { countUnread, listNotifications, markAllRead, notify } from '@/lib/services/notificationService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('grand livre des points', () => {
  let t: TestDb
  let lucie: string
  let tom: string
  let projectId: string

  beforeAll(async () => {
    t = createTestDb()
    lucie = (await t.prisma.user.create({ data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' } })).id
    tom = (await t.prisma.user.create({ data: { username: 'tom', displayName: 'Tom', passwordHash: 'x', role: 'JEUNE' } })).id
    projectId = (await t.prisma.project.create({ data: { title: 'Camp 2027' } })).id
  })
  afterAll(async () => { await t.cleanup() })

  it('additionne les lignes, y compris négatives', async () => {
    await creditPoints(t.prisma, { userId: lucie, projectId, amount: 25, reason: 'TACHE' })
    await creditPoints(t.prisma, { userId: lucie, projectId, amount: 5, reason: 'BONUS' })
    await creditPoints(t.prisma, { userId: lucie, projectId, amount: -10, reason: 'ANNULATION' })
    expect(await getScore(t.prisma, lucie)).toBe(20)
  })

  it('rend 0 pour un jeune sans aucune ligne', async () => {
    expect(await getScore(t.prisma, tom)).toBe(0)
  })

  // Review Focus 1
  it('refuse deux crédits pour la même soumission', async () => {
    const input = { userId: tom, projectId, amount: 25, reason: 'TACHE' as const, submissionId: 'sub-42' }
    await creditPoints(t.prisma, input)
    await expect(creditPoints(t.prisma, input)).rejects.toBeInstanceOf(DuplicateAwardError)
    expect(await getScore(t.prisma, tom)).toBe(25)
  })

  it('autorise plusieurs jeunes sur la même soumission', async () => {
    await creditPoints(t.prisma, { userId: lucie, projectId, amount: 13, reason: 'TACHE', submissionId: 'sub-99' })
    await creditPoints(t.prisma, { userId: tom, projectId, amount: 13, reason: 'TACHE', submissionId: 'sub-99' })
    expect(await getScore(t.prisma, tom)).toBe(38)
  })

  it('rend le détail du score, du plus récent au plus ancien', async () => {
    const lignes = await getLedger(t.prisma, lucie)
    expect(lignes.length).toBeGreaterThan(0)
    expect(lignes[0].createdAt.getTime()).toBeGreaterThanOrEqual(lignes[lignes.length - 1].createdAt.getTime())
  })

  it('classe les jeunes par score décroissant', async () => {
    const classement = await getLeaderboard(t.prisma, projectId)
    expect(classement.map((r) => r.displayName)).toEqual(['Tom', 'Lucie'])
    expect(classement[0].points).toBe(38)
  })

  it('ne compte que le projet demandé', async () => {
    const autre = await t.prisma.project.create({ data: { title: 'Projet 2028' } })
    await creditPoints(t.prisma, { userId: lucie, projectId: autre.id, amount: 100, reason: 'TACHE' })
    expect(await getScore(t.prisma, lucie, projectId)).toBe(33)
    expect(await getScore(t.prisma, lucie)).toBe(133)
  })
})

describe('notifications', () => {
  let t: TestDb
  let userId: string

  beforeAll(async () => {
    t = createTestDb()
    userId = (await t.prisma.user.create({ data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' } })).id
  })
  afterAll(async () => { await t.cleanup() })

  it('compte les non lues et les marque toutes lues', async () => {
    await notify(t.prisma, userId, { type: 'TACHE_VALIDEE', message: 'Bravo !', link: '/cap/1' })
    await notify(t.prisma, userId, { type: 'BADGE', message: 'Nouveau badge', link: '/profil' })
    expect(await countUnread(t.prisma, userId)).toBe(2)

    await markAllRead(t.prisma, userId)
    expect(await countUnread(t.prisma, userId)).toBe(0)
    expect((await listNotifications(t.prisma, userId)).length).toBe(2)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm test tests/integration/points.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Écrire `src/lib/services/pointsService.ts`**

```ts
import { Prisma } from '@prisma/client'
import type { Db } from '@/lib/db'
import type { PointsReason } from '@/lib/domain/types'

export interface PointsInput {
  userId: string
  projectId: string
  amount: number
  reason: PointsReason
  taskId?: string
  submissionId?: string
  projectRoleId?: string
  badgeId?: string
}

export interface LedgerLine {
  id: string
  amount: number
  reason: string
  createdAt: Date
  taskTitle: string | null
}

export interface LeaderboardRow {
  userId: string
  displayName: string
  points: number
  badgeCount: number
}

export class DuplicateAwardError extends Error {
  constructor() {
    super('Ces points ont déjà été attribués pour cette soumission.')
    this.name = 'DuplicateAwardError'
  }
}

export async function creditPoints(db: Db, input: PointsInput): Promise<void> {
  try {
    await db.pointsEntry.create({ data: input })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new DuplicateAwardError()
    }
    throw error
  }
}

export async function getScore(db: Db, userId: string, projectId?: string): Promise<number> {
  const result = await db.pointsEntry.aggregate({
    where: { userId, ...(projectId ? { projectId } : {}) },
    _sum: { amount: true },
  })
  return result._sum.amount ?? 0
}

export async function getLedger(db: Db, userId: string, projectId?: string): Promise<LedgerLine[]> {
  const rows = await db.pointsEntry.findMany({
    where: { userId, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { task: { select: { title: true } } },
  })
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    reason: row.reason,
    createdAt: row.createdAt,
    taskTitle: row.task?.title ?? null,
  }))
}

export async function getLeaderboard(db: Db, projectId: string): Promise<LeaderboardRow[]> {
  const [sums, jeunes, badges] = await Promise.all([
    db.pointsEntry.groupBy({ by: ['userId'], where: { projectId }, _sum: { amount: true } }),
    db.user.findMany({ where: { role: 'JEUNE', isActive: true }, select: { id: true, displayName: true } }),
    db.userBadge.groupBy({ by: ['userId'], _count: { _all: true } }),
  ])

  const pointsByUser = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]))
  const badgesByUser = new Map(badges.map((b) => [b.userId, b._count._all]))

  return jeunes
    .map((jeune) => ({
      userId: jeune.id,
      displayName: jeune.displayName,
      points: pointsByUser.get(jeune.id) ?? 0,
      badgeCount: badgesByUser.get(jeune.id) ?? 0,
    }))
    .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName, 'fr'))
}
```

- [ ] **Step 4: Écrire `src/lib/services/notificationService.ts`**

```ts
import type { Db } from '@/lib/db'

export interface NotificationInput {
  type: string
  message: string
  link: string
}

export async function notify(db: Db, userId: string, input: NotificationInput): Promise<void> {
  await db.notification.create({ data: { userId, ...input } })
}

export async function notifyMany(db: Db, userIds: string[], input: NotificationInput): Promise<void> {
  if (userIds.length === 0) return
  await db.notification.createMany({ data: userIds.map((userId) => ({ userId, ...input })) })
}

export async function countUnread(db: Db, userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } })
}

export async function listNotifications(db: Db, userId: string, limit = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit })
}

export async function markAllRead(db: Db, userId: string): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })
}
```

- [ ] **Step 5: Lancer les tests**

Run: `pnpm test tests/integration/points.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services tests/integration/points.test.ts
git commit -m "feat: grand livre des points, classement et notifications"
```

---

### Task 9: Statistiques et attribution des badges

**Files:**
- Create: `src/lib/services/badgeService.ts`
- Test: `tests/integration/badges.test.ts`

**Interfaces:**
- Consumes: `evaluateBadges`, `UserStats` (Tâche 5) ; `creditPoints` (Tâche 8) ; `notify` (Tâche 8).
- Produces:
  - `collectStats(db, userId): Promise<UserStats>`
  - `refreshBadges(db, userId, projectId): Promise<string[]>` — rend les codes nouvellement débloqués, crédite leurs points et notifie le jeune.

- [ ] **Step 1: Écrire le test d'intégration**

```ts
// tests/integration/badges.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectStats, refreshBadges } from '@/lib/services/badgeService'
import { getScore } from '@/lib/services/pointsService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('badges', () => {
  let t: TestDb
  let userId: string
  let projectId: string

  beforeEach(async () => {
    t = createTestDb()
    userId = (await t.prisma.user.create({ data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' } })).id
    projectId = (await t.prisma.project.create({ data: { title: 'Camp 2027' } })).id
    await t.prisma.badge.createMany({
      data: [
        { code: 'premier_pas', name: 'Premier pas', description: '1re tâche validée', icon: '🌱', ruleType: 'TACHES_VALIDEES', threshold: 1, points: 5 },
        { code: 'costaud', name: 'Costaud', description: 'une tâche difficile', icon: '💪', ruleType: 'TACHE_DIFFICILE', threshold: 1, points: 10 },
        { code: 'debut_fin', name: 'Du début à la fin', description: 'les 3 phases', icon: '🧭', ruleType: 'TOUTES_PHASES', threshold: 3, points: 20 },
      ],
    })
  })
  afterEach(async () => { await t.cleanup() })

  async function tacheTerminee(phase: string, difficulty: string, autreParticipant = false) {
    const task = await t.prisma.task.create({
      data: { projectId, title: `Tâche ${phase}`, phase, difficulty, status: 'TERMINEE', createdById: userId },
    })
    await t.prisma.taskAssignment.create({ data: { taskId: task.id, userId } })
    if (autreParticipant) {
      const autre = await t.prisma.user.create({
        data: { username: `u${Math.random()}`, displayName: 'Autre', passwordHash: 'x', role: 'JEUNE' },
      })
      await t.prisma.taskAssignment.create({ data: { taskId: task.id, userId: autre.id } })
    }
    return task
  }

  it('compte les tâches validées, difficiles et en équipe', async () => {
    await tacheTerminee('CHOISIR', 'FACILE')
    await tacheTerminee('AGIR', 'DIFFICILE', true)

    const stats = await collectStats(t.prisma, userId)
    expect(stats.validatedTaskCount).toBe(2)
    expect(stats.hardValidatedTaskCount).toBe(1)
    expect(stats.teamValidatedTaskCount).toBe(1)
    expect(stats.phasesByProject[projectId].sort()).toEqual(['AGIR', 'CHOISIR'])
  })

  it('ne compte que les tâches terminées', async () => {
    const task = await t.prisma.task.create({
      data: { projectId, title: 'En cours', phase: 'AGIR', difficulty: 'MOYEN', status: 'EN_COURS', createdById: userId },
    })
    await t.prisma.taskAssignment.create({ data: { taskId: task.id, userId } })
    expect((await collectStats(t.prisma, userId)).validatedTaskCount).toBe(0)
  })

  it('arrête la série sans refus au premier refus', async () => {
    const task = await tacheTerminee('AGIR', 'MOYEN')
    await t.prisma.submission.create({
      data: { taskId: task.id, submittedById: userId, decision: 'REFUSEE', reviewedAt: new Date(Date.now() - 2000) },
    })
    await t.prisma.submission.create({
      data: { taskId: task.id, submittedById: userId, decision: 'ACCEPTEE', reviewedAt: new Date(Date.now() - 1000) },
    })
    expect((await collectStats(t.prisma, userId)).cleanStreak).toBe(1)
  })

  it('débloque un badge, crédite ses points et notifie', async () => {
    await tacheTerminee('CHOISIR', 'DIFFICILE')

    const codes = await refreshBadges(t.prisma, userId, projectId)
    expect(codes.sort()).toEqual(['costaud', 'premier_pas'])
    expect(await getScore(t.prisma, userId)).toBe(15)
    expect(await t.prisma.notification.count({ where: { userId, type: 'BADGE' } })).toBe(2)
  })

  it('ne redonne jamais deux fois le même badge', async () => {
    await tacheTerminee('CHOISIR', 'FACILE')
    await refreshBadges(t.prisma, userId, projectId)
    expect(await refreshBadges(t.prisma, userId, projectId)).toEqual([])
    expect(await getScore(t.prisma, userId)).toBe(5)
  })

  it('exige les trois phases du même projet pour « du début à la fin »', async () => {
    await tacheTerminee('CHOISIR', 'FACILE')
    await tacheTerminee('AGIR', 'FACILE')
    expect(await refreshBadges(t.prisma, userId, projectId)).toEqual(['premier_pas'])

    await tacheTerminee('PARTAGER', 'FACILE')
    expect(await refreshBadges(t.prisma, userId, projectId)).toEqual(['debut_fin'])
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm test tests/integration/badges.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `src/lib/services/badgeService.ts`**

```ts
import type { Db } from '@/lib/db'
import { type BadgeRule, type UserStats, emptyStats, evaluateBadges } from '@/lib/domain/badges'
import type { BadgeRuleType } from '@/lib/domain/badges'
import type { Phase } from '@/lib/domain/types'
import { notify } from './notificationService'
import { creditPoints } from './pointsService'

export async function collectStats(db: Db, userId: string): Promise<UserStats> {
  const [assignments, closedRoleCount, photoSubmissionCount, reviewed] = await Promise.all([
    db.taskAssignment.findMany({
      where: { userId, task: { status: 'TERMINEE' } },
      include: { task: { include: { _count: { select: { assignments: true } } } } },
    }),
    db.projectRole.count({ where: { holderId: userId, closedAt: { not: null } } }),
    db.submission.count({ where: { submittedById: userId, attachments: { some: {} } } }),
    db.submission.findMany({
      where: { decision: { not: null }, task: { assignments: { some: { userId } } } },
      orderBy: { reviewedAt: 'desc' },
      select: { decision: true },
    }),
  ])

  const stats = emptyStats()
  stats.validatedTaskCount = assignments.length

  for (const { task } of assignments) {
    if (task.difficulty === 'DIFFICILE') stats.hardValidatedTaskCount += 1
    if (task._count.assignments >= 2) stats.teamValidatedTaskCount += 1
    const phases = stats.phasesByProject[task.projectId] ?? []
    phases.push(task.phase as Phase)
    stats.phasesByProject[task.projectId] = phases
  }

  for (const submission of reviewed) {
    if (submission.decision !== 'ACCEPTEE') break
    stats.cleanStreak += 1
  }

  stats.closedRoleCount = closedRoleCount
  stats.photoSubmissionCount = photoSubmissionCount
  return stats
}

/** Évalue les badges du jeune, enregistre les nouveaux, crédite leurs points et le prévient. */
export async function refreshBadges(db: Db, userId: string, projectId: string): Promise<string[]> {
  const [badges, earned, stats] = await Promise.all([
    db.badge.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.userBadge.findMany({ where: { userId }, include: { badge: { select: { code: true } } } }),
    collectStats(db, userId),
  ])

  const rules: BadgeRule[] = badges.map((b) => ({
    code: b.code,
    ruleType: b.ruleType as BadgeRuleType,
    threshold: b.threshold,
  }))

  const codes = evaluateBadges(rules, stats, earned.map((e) => e.badge.code))

  for (const code of codes) {
    const badge = badges.find((b) => b.code === code)!
    await db.userBadge.create({ data: { userId, badgeId: badge.id, projectId } })
    if (badge.points > 0) {
      await creditPoints(db, {
        userId,
        projectId,
        amount: badge.points,
        reason: 'BADGE',
        badgeId: badge.id,
      })
    }
    await notify(db, userId, {
      type: 'BADGE',
      message: `Badge débloqué : ${badge.name} ${badge.icon}`,
      link: '/profil',
    })
  }

  return codes
}
```

- [ ] **Step 4: Lancer les tests**

Run: `pnpm test tests/integration/badges.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/badgeService.ts tests/integration/badges.test.ts
git commit -m "feat: statistiques et attribution automatique des badges"
```

---

### Task 10: Photos — validation et stockage

**Files:**
- Create: `src/lib/domain/uploads.ts`, `src/lib/storage.ts`
- Test: `tests/unit/uploads.test.ts`, `tests/integration/storage.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `MAX_PHOTOS_PER_SUBMISSION`, `MAX_PHOTO_BYTES`, `ALLOWED_FORMATS`, `class UploadError`
  - `assertBatchAllowed(files: IncomingPhoto[], existingCount: number): void`
  - `storePhoto(buffer: Buffer, originalName: string): Promise<StoredPhoto>`
  - `readPhoto(storedName: string): Promise<Buffer>`, `deletePhoto(storedName: string): Promise<void>`

- [ ] **Step 1: Installer sharp**

```bash
pnpm add sharp
```

- [ ] **Step 2: Écrire les tests unitaires de validation**

```ts
// tests/unit/uploads.test.ts
import { describe, expect, it } from 'vitest'
import { MAX_PHOTOS_PER_SUBMISSION, UploadError, assertBatchAllowed } from '@/lib/domain/uploads'

const photo = (over = {}) => ({ sizeBytes: 1_000, format: 'jpeg', originalName: 'photo.jpg', ...over })

describe('assertBatchAllowed', () => {
  it('accepte un lot valide', () => {
    expect(() => assertBatchAllowed([photo(), photo()], 0)).not.toThrow()
  })

  it('accepte un envoi sans photo', () => {
    expect(() => assertBatchAllowed([], 0)).not.toThrow()
  })

  it('refuse au delà de 3 photos, en comptant celles déjà présentes', () => {
    expect(() => assertBatchAllowed([photo(), photo(), photo(), photo()], 0)).toThrow(UploadError)
    expect(() => assertBatchAllowed([photo(), photo()], 2)).toThrow(/3 photos/)
    expect(MAX_PHOTOS_PER_SUBMISSION).toBe(3)
  })

  it('refuse un fichier de plus de 8 Mo', () => {
    expect(() => assertBatchAllowed([photo({ sizeBytes: 9 * 1024 * 1024 })], 0)).toThrow(/8 Mo/)
  })

  it('refuse un fichier vide', () => {
    expect(() => assertBatchAllowed([photo({ sizeBytes: 0 })], 0)).toThrow(/vide/i)
  })

  it('refuse un format non image, quelle que soit l extension', () => {
    expect(() => assertBatchAllowed([photo({ format: null, originalName: 'virus.jpg' })], 0)).toThrow(/image/i)
    expect(() => assertBatchAllowed([photo({ format: 'gif' })], 0)).toThrow(/JPEG, PNG ou WebP/)
  })

  it('nomme le fichier fautif dans le message', () => {
    expect(() => assertBatchAllowed([photo({ format: 'pdf', originalName: 'dossier.pdf' })], 0)).toThrow(/dossier\.pdf/)
  })
})
```

- [ ] **Step 3: Écrire `src/lib/domain/uploads.ts`**

```ts
export const MAX_PHOTOS_PER_SUBMISSION = 3
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'] as const
export type AllowedFormat = (typeof ALLOWED_FORMATS)[number]

export interface IncomingPhoto {
  sizeBytes: number
  /** Format RÉEL détecté en lisant le fichier, jamais déduit de l'extension. */
  format: string | null
  originalName: string
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadError'
  }
}

export function assertBatchAllowed(files: IncomingPhoto[], existingCount: number): void {
  if (existingCount + files.length > MAX_PHOTOS_PER_SUBMISSION) {
    throw new UploadError(`Une soumission accepte au maximum ${MAX_PHOTOS_PER_SUBMISSION} photos.`)
  }

  for (const file of files) {
    if (file.sizeBytes <= 0) {
      throw new UploadError(`Le fichier « ${file.originalName} » est vide.`)
    }
    if (file.sizeBytes > MAX_PHOTO_BYTES) {
      throw new UploadError(`Le fichier « ${file.originalName} » dépasse 8 Mo.`)
    }
    if (file.format === null) {
      throw new UploadError(`Le fichier « ${file.originalName} » n'est pas une image.`)
    }
    if (!ALLOWED_FORMATS.includes(file.format as AllowedFormat)) {
      throw new UploadError(`Le fichier « ${file.originalName} » doit être au format JPEG, PNG ou WebP.`)
    }
  }
}
```

- [ ] **Step 4: Écrire le test de stockage**

```ts
// tests/integration/storage.test.ts
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'cap-uploads-'))
  process.env.UPLOAD_DIR = dir
})
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

async function jpegAvecExif(width = 2400, height = 1200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 80 } } })
    .withExif({ IFD0: { Copyright: 'Caravane', Software: 'test' } })
    .jpeg()
    .toBuffer()
}

describe('storePhoto', () => {
  it('réencode en WebP, redimensionne et supprime les métadonnées EXIF', async () => {
    const { storePhoto } = await import('@/lib/storage')
    const stored = await storePhoto(await jpegAvecExif(), 'photo du camp.jpg')

    expect(stored.mimeType).toBe('image/webp')
    expect(stored.width).toBe(1600)
    expect(stored.height).toBe(800)
    expect(stored.storedName).toMatch(/^[a-f0-9]{32}\.webp$/)
    expect(stored.originalName).toBe('photo du camp.jpg')

    const meta = await sharp(await readFile(join(dir, stored.storedName))).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.exif).toBeUndefined()
  })

  it('n agrandit pas une petite image', async () => {
    const { storePhoto } = await import('@/lib/storage')
    const stored = await storePhoto(await jpegAvecExif(400, 300), 'petite.jpg')
    expect(stored.width).toBe(400)
  })

  it('refuse un fichier qui n est pas une image', async () => {
    const { storePhoto } = await import('@/lib/storage')
    await expect(storePhoto(Buffer.from('bonjour, je ne suis pas une image'), 'faux.jpg'))
      .rejects.toThrow(/n'est pas une image/)
  })

  it('relit puis supprime un fichier stocké', async () => {
    const { deletePhoto, readPhoto, storePhoto } = await import('@/lib/storage')
    const stored = await storePhoto(await jpegAvecExif(600, 600), 'carre.jpg')

    expect((await readPhoto(stored.storedName)).length).toBeGreaterThan(0)

    await deletePhoto(stored.storedName)
    await expect(readPhoto(stored.storedName)).rejects.toThrow()
    await expect(deletePhoto(stored.storedName)).resolves.toBeUndefined()
  })

  it('refuse un nom de fichier contenant un chemin', async () => {
    const { readPhoto } = await import('@/lib/storage')
    await expect(readPhoto('../../etc/passwd')).rejects.toThrow(/nom de fichier/i)
  })
})
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm test tests/unit/uploads.test.ts tests/integration/storage.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 6: Écrire `src/lib/storage.ts`**

```ts
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { MAX_PHOTO_BYTES, UploadError, assertBatchAllowed } from '@/lib/domain/uploads'

export interface StoredPhoto {
  storedName: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
}

const MAX_EDGE = 1600

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? './.uploads'
}

function assertSafeName(storedName: string): void {
  if (!/^[a-f0-9]{32}\.webp$/.test(storedName)) {
    throw new UploadError('Nom de fichier invalide.')
  }
}

/**
 * Valide, réencode en WebP sans métadonnées, redimensionne et écrit sur le volume.
 * Rien n'est écrit tant que l'image n'a pas été décodée avec succès.
 */
export async function storePhoto(buffer: Buffer, originalName: string): Promise<StoredPhoto> {
  let format: string | null = null
  try {
    format = (await sharp(buffer).metadata()).format ?? null
  } catch {
    format = null
  }

  assertBatchAllowed([{ sizeBytes: buffer.byteLength, format, originalName }], 0)
  if (buffer.byteLength > MAX_PHOTO_BYTES) throw new UploadError(`Le fichier « ${originalName} » dépasse 8 Mo.`)

  // sharp ne recopie pas les métadonnées par défaut : l'EXIF, donc la
  // géolocalisation éventuelle, disparaît au réencodage.
  const output = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })

  const storedName = `${randomBytes(16).toString('hex')}.webp`
  await mkdir(uploadDir(), { recursive: true })
  await writeFile(join(uploadDir(), storedName), output.data)

  return {
    storedName,
    originalName,
    mimeType: 'image/webp',
    sizeBytes: output.data.byteLength,
    width: output.info.width,
    height: output.info.height,
  }
}

export async function readPhoto(storedName: string): Promise<Buffer> {
  assertSafeName(storedName)
  return readFile(join(uploadDir(), storedName))
}

export async function deletePhoto(storedName: string): Promise<void> {
  assertSafeName(storedName)
  await unlink(join(uploadDir(), storedName)).catch(() => undefined)
}
```

- [ ] **Step 7: Lancer les tests**

Run: `pnpm test tests/unit/uploads.test.ts tests/integration/storage.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/domain/uploads.ts src/lib/storage.ts tests/unit/uploads.test.ts tests/integration/storage.test.ts
git commit -m "feat: validation et stockage des photos de soumission"
```

---

### Task 11: Services projet, tâches et réglages

**Files:**
- Create: `src/lib/services/projectService.ts`, `src/lib/services/taskService.ts`, `src/lib/services/settingsService.ts`, `src/lib/services/errors.ts`
- Test: `tests/integration/tasks.test.ts`

**Interfaces:**
- Consumes: machine à états (Tâche 4), `notify`/`notifyMany` (Tâche 8).
- Produces:
  - `errors.ts` : `NotFoundError`, `ForbiddenError`, `ValidationError`
  - `projectService` : `createProject(db, actor, input)`, `getActiveProject(db)`, `listProjects(db)`, `setPhase(db, actor, projectId, phase)`, `archiveProject(db, actor, projectId)`
  - `settingsService` : `getScale(db): Promise<PointsScale>`, `setScale(db, scale): Promise<void>`
  - `taskService` : `createTask(db, actor, input)`, `decideProposal(db, actor, taskId, accept)`, `joinTask(db, actor, taskId)`, `leaveTask(db, actor, taskId)`, `removeParticipant(db, actor, taskId, userId)`, `getTaskDetail(db, taskId)`, `listBoard(db, projectId)`

- [ ] **Step 1: Écrire le test d'intégration**

```ts
// tests/integration/tasks.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { TaskTransitionError } from '@/lib/domain/tasks'
import type { Actor } from '@/lib/domain/types'
import { archiveProject, createProject } from '@/lib/services/projectService'
import { createTask, decideProposal, joinTask, leaveTask, listBoard, removeParticipant } from '@/lib/services/taskService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('tâches', () => {
  let t: TestDb
  let chef: Actor
  let lucie: Actor
  let tom: Actor
  let projectId: string

  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    tom = await mk('tom', 'JEUNE')
    projectId = (await createProject(t.prisma, chef, { title: 'Camp 2027' })).id
  })
  afterEach(async () => { await t.cleanup() })

  const nouvelleTache = (actor: Actor) =>
    createTask(t.prisma, actor, { projectId, title: 'Faire le budget', phase: 'AGIR', difficulty: 'MOYEN' })

  it('ouvre directement une tâche créée par un chef', async () => {
    expect((await nouvelleTache(chef)).status).toBe('OUVERTE')
  })

  it('met en attente une tâche proposée par un jeune et prévient les chefs', async () => {
    const task = await nouvelleTache(lucie)
    expect(task.status).toBe('PROPOSEE')
    expect(await t.prisma.notification.count({ where: { userId: chef.id, type: 'PROPOSITION' } })).toBe(1)
  })

  it('accepte une proposition et prévient son auteur', async () => {
    const task = await nouvelleTache(lucie)
    expect((await decideProposal(t.prisma, chef, task.id, true)).status).toBe('OUVERTE')
    expect(await t.prisma.notification.count({ where: { userId: lucie.id, type: 'PROPOSITION_ACCEPTEE' } })).toBe(1)
  })

  it('refuse qu un jeune accepte une proposition', async () => {
    const task = await nouvelleTache(lucie)
    await expect(decideProposal(t.prisma, tom, task.id, true)).rejects.toBeInstanceOf(TaskTransitionError)
  })

  it('inscrit un jeune et passe la tâche en cours', async () => {
    const task = await nouvelleTache(chef)
    const apres = await joinTask(t.prisma, lucie, task.id)
    expect(apres.status).toBe('EN_COURS')
    expect(await t.prisma.taskAssignment.count({ where: { taskId: task.id } })).toBe(1)
  })

  it('refuse une double inscription', async () => {
    const task = await nouvelleTache(chef)
    await joinTask(t.prisma, lucie, task.id)
    await expect(joinTask(t.prisma, lucie, task.id)).rejects.toBeInstanceOf(TaskTransitionError)
  })

  it('rouvre la tâche quand le dernier inscrit se retire', async () => {
    const task = await nouvelleTache(chef)
    await joinTask(t.prisma, lucie, task.id)
    await joinTask(t.prisma, tom, task.id)

    expect((await leaveTask(t.prisma, tom, task.id)).status).toBe('EN_COURS')
    expect((await leaveTask(t.prisma, lucie, task.id)).status).toBe('OUVERTE')
  })

  it('laisse un chef retirer un participant', async () => {
    const task = await nouvelleTache(chef)
    await joinTask(t.prisma, lucie, task.id)
    await removeParticipant(t.prisma, chef, task.id, lucie.id)
    expect(await t.prisma.taskAssignment.count({ where: { taskId: task.id } })).toBe(0)
  })

  it('refuse qu un jeune retire quelqu un d autre', async () => {
    const task = await nouvelleTache(chef)
    await joinTask(t.prisma, lucie, task.id)
    await expect(removeParticipant(t.prisma, tom, task.id, lucie.id)).rejects.toBeInstanceOf(TaskTransitionError)
  })

  it('interdit toute action sur un CAP archivé', async () => {
    const task = await nouvelleTache(chef)
    await archiveProject(t.prisma, chef, projectId)
    await expect(joinTask(t.prisma, lucie, task.id)).rejects.toBeInstanceOf(TaskTransitionError)
    await expect(createTask(t.prisma, chef, { projectId, title: 'Trop tard', phase: 'AGIR', difficulty: 'FACILE' }))
      .rejects.toThrow(/archivé/)
  })

  it('range le tableau par phase, sans les propositions en attente ni les rejetées', async () => {
    await createTask(t.prisma, chef, { projectId, title: 'A', phase: 'CHOISIR', difficulty: 'FACILE' })
    await createTask(t.prisma, chef, { projectId, title: 'B', phase: 'AGIR', difficulty: 'FACILE' })
    const proposee = await nouvelleTache(lucie)
    await decideProposal(t.prisma, chef, proposee.id, false)

    const board = await listBoard(t.prisma, projectId)
    expect(board.CHOISIR.map((task) => task.title)).toEqual(['A'])
    expect(board.AGIR.map((task) => task.title)).toEqual(['B'])
    expect(board.PARTAGER).toEqual([])
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm test tests/integration/tasks.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Écrire `src/lib/services/errors.ts`**

```ts
export class NotFoundError extends Error {
  constructor(quoi = 'Élément') {
    super(`${quoi} introuvable.`)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Action réservée aux chefs.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

- [ ] **Step 4: Écrire `src/lib/services/projectService.ts`**

```ts
import type { Db } from '@/lib/db'
import type { Actor, Phase } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

export interface CreateProjectInput {
  title: string
  description?: string
}

export async function createProject(db: Db, actor: Actor, input: CreateProjectInput) {
  if (!isChef(actor)) throw new ForbiddenError()
  if (!input.title.trim()) throw new ValidationError('Le titre du CAP est obligatoire.')

  return db.project.create({
    data: { title: input.title.trim(), description: input.description?.trim() ?? '', status: 'EN_COURS' },
  })
}

/** Le CAP en cours. Il n'y en a qu'un à la fois : le plus récemment démarré. */
export async function getActiveProject(db: Db) {
  return db.project.findFirst({ where: { status: 'EN_COURS' }, orderBy: { startedAt: 'desc' } })
}

export async function listProjects(db: Db) {
  return db.project.findMany({ orderBy: { startedAt: 'desc' } })
}

export async function setPhase(db: Db, actor: Actor, projectId: string, phase: Phase) {
  if (!isChef(actor)) throw new ForbiddenError()
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new NotFoundError('CAP')
  if (project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé.')

  return db.project.update({ where: { id: projectId }, data: { currentPhase: phase } })
}

export async function archiveProject(db: Db, actor: Actor, projectId: string) {
  if (!isChef(actor)) throw new ForbiddenError()
  return db.project.update({
    where: { id: projectId },
    data: { status: 'ARCHIVE', archivedAt: new Date() },
  })
}
```

- [ ] **Step 5: Écrire `src/lib/services/settingsService.ts`**

```ts
import type { Db } from '@/lib/db'
import { DEFAULT_SCALE, type PointsScale, parseScale } from '@/lib/domain/points'

const SCALE_KEY = 'pointsScale'

export async function getScale(db: Db): Promise<PointsScale> {
  const setting = await db.setting.findUnique({ where: { key: SCALE_KEY } })
  return parseScale(setting?.value)
}

export async function setScale(db: Db, scale: PointsScale): Promise<void> {
  const value = JSON.stringify(scale)
  await db.setting.upsert({ where: { key: SCALE_KEY }, update: { value }, create: { key: SCALE_KEY, value } })
}

export { DEFAULT_SCALE }
```

- [ ] **Step 6: Écrire `src/lib/services/taskService.ts`**

```ts
import type { Db } from '@/lib/db'
import { type TaskAction, type TaskContext, nextStatus } from '@/lib/domain/tasks'
import type { Actor, Difficulty, Phase, TaskStatus } from '@/lib/domain/types'
import { PHASES, isChef } from '@/lib/domain/types'
import { NotFoundError, ValidationError } from './errors'
import { notify, notifyMany } from './notificationService'

export interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  phase: Phase
  difficulty: Difficulty
  dueDate?: Date | null
}

async function loadTask(db: Db, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: true, assignments: true, _count: { select: { submissions: true } } },
  })
  if (!task) throw new NotFoundError('Tâche')
  return task
}

function contextFor(
  task: Awaited<ReturnType<typeof loadTask>>,
  actor: Actor,
  subjectUserId = actor.id,
): TaskContext {
  return {
    status: task.status as TaskStatus,
    participantCount: task.assignments.length,
    hasSubmission: task._count.submissions > 0,
    projectArchived: task.project.status === 'ARCHIVE',
    isParticipant: task.assignments.some((a) => a.userId === subjectUserId),
    actorRole: actor.role,
  }
}

async function chefIds(db: Db): Promise<string[]> {
  const chefs = await db.user.findMany({
    where: { role: { in: ['CHEF', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  })
  return chefs.map((c) => c.id)
}

export async function createTask(db: Db, actor: Actor, input: CreateTaskInput) {
  if (!input.title.trim()) throw new ValidationError('Le titre de la tâche est obligatoire.')

  const project = await db.project.findUnique({ where: { id: input.projectId } })
  if (!project) throw new NotFoundError('CAP')
  if (project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé, on ne peut plus y ajouter de tâche.')

  const status: TaskStatus = isChef(actor) ? 'OUVERTE' : 'PROPOSEE'

  const task = await db.task.create({
    data: {
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      phase: input.phase,
      difficulty: input.difficulty,
      status,
      createdById: actor.id,
      dueDate: input.dueDate ?? null,
    },
  })

  if (status === 'PROPOSEE') {
    await notifyMany(db, await chefIds(db), {
      type: 'PROPOSITION',
      message: `${actor.displayName} propose la tâche « ${task.title} »`,
      link: '/validation',
    })
  } else {
    const jeunes = await db.user.findMany({ where: { role: 'JEUNE', isActive: true }, select: { id: true } })
    await notifyMany(db, jeunes.map((j) => j.id), {
      type: 'NOUVELLE_TACHE',
      message: `Nouvelle tâche à prendre : « ${task.title} »`,
      link: `/cap/${task.id}`,
    })
  }

  return task
}

async function applyAction(db: Db, task: Awaited<ReturnType<typeof loadTask>>, ctx: TaskContext, action: TaskAction) {
  const status = nextStatus(ctx, action)
  return db.task.update({ where: { id: task.id }, data: { status } })
}

export async function decideProposal(db: Db, actor: Actor, taskId: string, accept: boolean) {
  const task = await loadTask(db, taskId)
  const updated = await applyAction(
    db,
    task,
    contextFor(task, actor),
    accept ? 'ACCEPTER_PROPOSITION' : 'REFUSER_PROPOSITION',
  )

  await notify(db, task.createdById, {
    type: accept ? 'PROPOSITION_ACCEPTEE' : 'PROPOSITION_REFUSEE',
    message: accept
      ? `Ta proposition « ${task.title} » a été acceptée !`
      : `Ta proposition « ${task.title} » n'a pas été retenue.`,
    link: accept ? `/cap/${task.id}` : '/cap',
  })

  return updated
}

export async function joinTask(db: Db, actor: Actor, taskId: string) {
  const task = await loadTask(db, taskId)
  const updated = await applyAction(db, task, contextFor(task, actor), 'S_INSCRIRE')
  await db.taskAssignment.create({ data: { taskId, userId: actor.id } })
  return updated
}

export async function leaveTask(db: Db, actor: Actor, taskId: string) {
  const task = await loadTask(db, taskId)
  const updated = await applyAction(db, task, contextFor(task, actor), 'SE_DESINSCRIRE')
  await db.taskAssignment.deleteMany({ where: { taskId, userId: actor.id } })
  return updated
}

export async function removeParticipant(db: Db, actor: Actor, taskId: string, userId: string) {
  const task = await loadTask(db, taskId)
  const updated = await applyAction(db, task, contextFor(task, actor, userId), 'RETIRER_PARTICIPANT')
  await db.taskAssignment.deleteMany({ where: { taskId, userId } })

  await notify(db, userId, {
    type: 'RETIRE_TACHE',
    message: `Un chef t'a retiré de la tâche « ${task.title} »`,
    link: `/cap/${task.id}`,
  })

  return updated
}

export async function getTaskDetail(db: Db, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      createdBy: { select: { id: true, displayName: true } },
      assignments: { include: { user: { select: { id: true, displayName: true } } } },
      submissions: {
        orderBy: { createdAt: 'asc' },
        include: {
          submittedBy: { select: { displayName: true } },
          reviewedBy: { select: { displayName: true } },
          attachments: true,
        },
      },
    },
  })
  if (!task) throw new NotFoundError('Tâche')
  return task
}

export type BoardColumn = Awaited<ReturnType<typeof listBoard>>[Phase]

export async function listBoard(db: Db, projectId: string) {
  const tasks = await db.task.findMany({
    where: { projectId, status: { notIn: ['PROPOSEE', 'REJETEE'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: { assignments: { include: { user: { select: { id: true, displayName: true } } } } },
  })

  const board = Object.fromEntries(PHASES.map((phase) => [phase, [] as typeof tasks])) as Record<Phase, typeof tasks>
  for (const task of tasks) board[task.phase as Phase].push(task)
  return board
}
```

- [ ] **Step 7: Lancer les tests**

Run: `pnpm test tests/integration/tasks.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/services tests/integration/tasks.test.ts
git commit -m "feat: services CAP, tâches et réglages"
```

---

### Task 12: Soumission et revue — le cœur du produit

**Files:**
- Create: `src/lib/services/submissionService.ts`
- Test: `tests/integration/submissions.test.ts`

**Interfaces:**
- Consumes: `computeTaskAward` (T3), `nextStatus` (T4), `storePhoto`/`deletePhoto` (T10), `creditPoints` (T8), `refreshBadges` (T9), `getScale` (T11), `getTaskDetail` (T11).
- Produces:
  - `submitTask(db, actor, input: SubmitInput): Promise<{ submissionId: string }>`
  - `reviewSubmission(db, actor, input: ReviewInput): Promise<ReviewResult>`
  - `cancelValidation(db, actor, taskId): Promise<void>`
  - `listPendingSubmissions(db)`
  - `class AlreadyReviewedError`
- `db` est ici un `PrismaClient` complet : le service ouvre sa propre transaction.

- [ ] **Step 1: Écrire le test d'intégration**

```ts
// tests/integration/submissions.test.ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createProject } from '@/lib/services/projectService'
import { getScore } from '@/lib/services/pointsService'
import { AlreadyReviewedError, cancelValidation, reviewSubmission, submitTask } from '@/lib/services/submissionService'
import { createTask, joinTask, removeParticipant } from '@/lib/services/taskService'
import { createTestDb, type TestDb } from '../helpers/db'

async function photo(): Promise<Buffer> {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: '#2b7' } }).jpeg().toBuffer()
}

describe('soumission et revue', () => {
  let t: TestDb
  let dir: string
  let chef: Actor
  let lucie: Actor
  let tom: Actor
  let projectId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cap-sub-'))
    process.env.UPLOAD_DIR = dir
    t = createTestDb()

    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    tom = await mk('tom', 'JEUNE')
    projectId = (await createProject(t.prisma, chef, { title: 'Camp 2027' })).id

    await t.prisma.badge.create({
      data: { code: 'premier_pas', name: 'Premier pas', description: '1re tâche', icon: '🌱', ruleType: 'TACHES_VALIDEES', threshold: 1, points: 5 },
    })
  })
  afterEach(async () => {
    await t.cleanup()
    rmSync(dir, { recursive: true, force: true })
  })

  async function tachePrete(difficulty = 'MOYEN' as const, participants: Actor[] = [lucie]) {
    const task = await createTask(t.prisma, chef, { projectId, title: 'Budget', phase: 'AGIR', difficulty })
    for (const p of participants) await joinTask(t.prisma, p, task.id)
    return task
  }

  it('enregistre la soumission, ses photos, et passe la tâche en SOUMISE', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, {
      taskId: task.id,
      message: 'Budget bouclé',
      photos: [{ buffer: await photo(), originalName: 'budget.jpg' }],
    })

    expect((await t.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('SOUMISE')
    expect(await t.prisma.attachment.count({ where: { submissionId } })).toBe(1)
    expect(await t.prisma.notification.count({ where: { userId: chef.id, type: 'SOUMISSION' } })).toBe(1)
  })

  it('refuse la soumission par un jeune non inscrit', async () => {
    const task = await tachePrete()
    await expect(submitTask(t.prisma, tom, { taskId: task.id, message: '', photos: [] })).rejects.toThrow()
  })

  it('refuse une quatrième photo sans rien écrire sur le disque', async () => {
    const task = await tachePrete()
    const img = await photo()
    await expect(
      submitTask(t.prisma, lucie, {
        taskId: task.id,
        message: '',
        photos: Array.from({ length: 4 }, (_, i) => ({ buffer: img, originalName: `p${i}.jpg` })),
      }),
    ).rejects.toThrow(/3 photos/)
    expect(await t.prisma.attachment.count()).toBe(0)
  })

  it('valide : crédite les points, termine la tâche, débloque les badges, notifie', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: 'fini', photos: [] })

    const result = await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE', bonus: 5 })

    expect(result.taskStatus).toBe('TERMINEE')
    expect(result.awarded).toEqual([{ userId: lucie.id, amount: 30 }])
    expect(result.newBadges).toEqual([{ userId: lucie.id, codes: ['premier_pas'] }])
    expect(await getScore(t.prisma, lucie.id)).toBe(35) // 25 + 5 de bonus + 5 du badge
    expect(await t.prisma.notification.count({ where: { userId: lucie.id, type: 'TACHE_VALIDEE' } })).toBe(1)
  })

  it('partage les points entre les participants, arrondi au supérieur', async () => {
    const task = await tachePrete('MOYEN', [lucie, tom])
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    const result = await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })

    expect(result.awarded.map((a) => a.amount)).toEqual([13, 13])
  })

  // Review Focus 3
  it('partage selon les participants présents AU MOMENT de la validation', async () => {
    const task = await tachePrete('MOYEN', [lucie, tom])
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await removeParticipant(t.prisma, chef, task.id, tom.id)

    const result = await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })

    expect(result.awarded).toEqual([{ userId: lucie.id, amount: 25 }])
    expect(await getScore(t.prisma, tom.id)).toBe(0)
  })

  it('refuse de valider une tâche dont tous les participants ont été retirés', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await removeParticipant(t.prisma, chef, task.id, lucie.id)

    await expect(reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' }))
      .rejects.toThrow(/participant/i)
  })

  // Review Focus 1
  it('refuse une seconde revue de la même soumission, sans recréditer', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })

    await expect(reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' }))
      .rejects.toBeInstanceOf(AlreadyReviewedError)
    expect(await getScore(t.prisma, lucie.id)).toBe(30) // 25 + 5 du badge, pas davantage
  })

  it('exige un commentaire pour refuser, et remet la tâche à corriger', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    await expect(reviewSubmission(t.prisma, chef, { submissionId, decision: 'REFUSEE', comment: '   ' }))
      .rejects.toThrow(/commentaire/i)

    const result = await reviewSubmission(t.prisma, chef, {
      submissionId, decision: 'REFUSEE', comment: 'Il manque les recettes.',
    })
    expect(result.taskStatus).toBe('A_CORRIGER')
    expect(await getScore(t.prisma, lucie.id)).toBe(0)
    expect(await t.prisma.notification.count({ where: { userId: lucie.id, type: 'TACHE_REFUSEE' } })).toBe(1)
  })

  it('permet de resoumettre après un refus', async () => {
    const task = await tachePrete()
    const first = await submitTask(t.prisma, lucie, { taskId: task.id, message: 'v1', photos: [] })
    await reviewSubmission(t.prisma, chef, { submissionId: first.submissionId, decision: 'REFUSEE', comment: 'à revoir' })

    const second = await submitTask(t.prisma, lucie, { taskId: task.id, message: 'v2', photos: [] })
    const result = await reviewSubmission(t.prisma, chef, { submissionId: second.submissionId, decision: 'ACCEPTEE' })

    expect(result.taskStatus).toBe('TERMINEE')
    expect(await t.prisma.submission.count({ where: { taskId: task.id } })).toBe(2)
  })

  it('refuse qu un jeune valide une soumission', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await expect(reviewSubmission(t.prisma, tom, { submissionId, decision: 'ACCEPTEE' })).rejects.toThrow()
  })

  it('annule une validation : points repris, tâche à corriger', async () => {
    const task = await tachePrete()
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })

    await cancelValidation(t.prisma, chef, task.id)

    expect((await t.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('A_CORRIGER')
    expect(await getScore(t.prisma, lucie.id)).toBe(5) // les points de la tâche repris, le badge reste
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm test tests/integration/submissions.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `src/lib/services/submissionService.ts`**

```ts
import type { PrismaClient } from '@prisma/client'
import { computeTaskAward } from '@/lib/domain/points'
import { nextStatus, type TaskContext } from '@/lib/domain/tasks'
import { MAX_PHOTOS_PER_SUBMISSION, UploadError } from '@/lib/domain/uploads'
import type { Actor, Difficulty, ReviewDecision, TaskStatus } from '@/lib/domain/types'
import { deletePhoto, storePhoto, type StoredPhoto } from '@/lib/storage'
import { refreshBadges } from './badgeService'
import { NotFoundError, ValidationError } from './errors'
import { notify, notifyMany } from './notificationService'
import { creditPoints } from './pointsService'
import { getScale } from './settingsService'

export interface SubmitInput {
  taskId: string
  message: string
  photos: { buffer: Buffer; originalName: string }[]
}

export interface ReviewInput {
  submissionId: string
  decision: ReviewDecision
  comment?: string
  bonus?: number
}

export interface ReviewResult {
  taskStatus: TaskStatus
  awarded: { userId: string; amount: number }[]
  newBadges: { userId: string; codes: string[] }[]
}

export class AlreadyReviewedError extends Error {
  constructor() {
    super('Cette soumission a déjà été traitée par un chef.')
    this.name = 'AlreadyReviewedError'
  }
}

async function chefIds(db: PrismaClient): Promise<string[]> {
  const chefs = await db.user.findMany({
    where: { role: { in: ['CHEF', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  })
  return chefs.map((c) => c.id)
}

export async function submitTask(db: PrismaClient, actor: Actor, input: SubmitInput): Promise<{ submissionId: string }> {
  if (input.photos.length > MAX_PHOTOS_PER_SUBMISSION) {
    throw new UploadError(`Une soumission accepte au maximum ${MAX_PHOTOS_PER_SUBMISSION} photos.`)
  }

  const task = await db.task.findUnique({
    where: { id: input.taskId },
    include: { project: true, assignments: true, _count: { select: { submissions: true } } },
  })
  if (!task) throw new NotFoundError('Tâche')

  const ctx: TaskContext = {
    status: task.status as TaskStatus,
    participantCount: task.assignments.length,
    hasSubmission: task._count.submissions > 0,
    projectArchived: task.project.status === 'ARCHIVE',
    isParticipant: task.assignments.some((a) => a.userId === actor.id),
    actorRole: actor.role,
  }
  const status = nextStatus(ctx, 'SOUMETTRE')

  // Les photos sont écrites avant la transaction ; si celle-ci échoue, on les retire.
  const stored: StoredPhoto[] = []
  try {
    for (const photo of input.photos) {
      stored.push(await storePhoto(photo.buffer, photo.originalName))
    }

    const submission = await db.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: { taskId: task.id, submittedById: actor.id, message: input.message.trim() },
      })
      if (stored.length > 0) {
        await tx.attachment.createMany({
          data: stored.map((photo) => ({ ...photo, submissionId: created.id, uploadedById: actor.id })),
        })
      }
      await tx.task.update({ where: { id: task.id }, data: { status } })
      return created
    })

    await notifyMany(db, await chefIds(db), {
      type: 'SOUMISSION',
      message: `${actor.displayName} a rendu « ${task.title} »`,
      link: '/validation',
    })

    return { submissionId: submission.id }
  } catch (error) {
    await Promise.all(stored.map((photo) => deletePhoto(photo.storedName)))
    throw error
  }
}

export async function reviewSubmission(db: PrismaClient, actor: Actor, input: ReviewInput): Promise<ReviewResult> {
  const scale = await getScale(db)

  const { taskStatus, awarded, projectId, taskTitle, participantIds } = await db.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({
      where: { id: input.submissionId },
      include: { task: { include: { project: true, assignments: true, _count: { select: { submissions: true } } } } },
    })
    if (!submission) throw new NotFoundError('Soumission')
    // Verrou logique : une soumission déjà tranchée ne repasse jamais ici.
    if (submission.decision) throw new AlreadyReviewedError()

    const task = submission.task
    const ctx: TaskContext = {
      status: task.status as TaskStatus,
      participantCount: task.assignments.length,
      hasSubmission: task._count.submissions > 0,
      projectArchived: task.project.status === 'ARCHIVE',
      isParticipant: task.assignments.some((a) => a.userId === actor.id),
      actorRole: actor.role,
    }

    const accepted = input.decision === 'ACCEPTEE'
    const status = nextStatus(ctx, accepted ? 'VALIDER' : 'REFUSER')

    const comment = input.comment?.trim() ?? ''
    if (!accepted && comment.length === 0) {
      throw new ValidationError('Un refus doit être accompagné d\'un commentaire pour le jeune.')
    }

    const participants = task.assignments.map((a) => a.userId)
    const bonus = Math.max(0, Math.round(input.bonus ?? 0))
    const results: { userId: string; amount: number }[] = []

    if (accepted) {
      if (participants.length === 0) {
        throw new ValidationError('Cette tâche n\'a plus aucun participant : impossible d\'attribuer des points.')
      }
      const amount = computeTaskAward(task.difficulty as Difficulty, participants.length, bonus, scale)
      for (const userId of participants) {
        await creditPoints(tx, {
          userId,
          projectId: task.projectId,
          amount,
          reason: 'TACHE',
          taskId: task.id,
          submissionId: submission.id,
        })
        results.push({ userId, amount })
      }
    }

    await tx.submission.update({
      where: { id: submission.id },
      data: {
        decision: input.decision,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewComment: comment,
        bonusPoints: accepted ? bonus : 0,
      },
    })
    await tx.task.update({ where: { id: task.id }, data: { status } })

    return {
      taskStatus: status,
      awarded: results,
      projectId: task.projectId,
      taskTitle: task.title,
      participantIds: participants,
    }
  })

  const accepted = input.decision === 'ACCEPTEE'
  await notifyMany(db, participantIds, {
    type: accepted ? 'TACHE_VALIDEE' : 'TACHE_REFUSEE',
    message: accepted
      ? `« ${taskTitle} » est validée, bravo !`
      : `« ${taskTitle} » est à corriger : ${input.comment?.trim()}`,
    link: `/cap/${(await db.submission.findUniqueOrThrow({ where: { id: input.submissionId } })).taskId}`,
  })

  // Les badges s'évaluent une fois la transaction validée, sur des données à jour.
  const newBadges: { userId: string; codes: string[] }[] = []
  if (accepted) {
    for (const userId of participantIds) {
      newBadges.push({ userId, codes: await refreshBadges(db, userId, projectId) })
    }
  }

  return { taskStatus, awarded, newBadges }
}

/** Annule la dernière validation d'une tâche : les points de la tâche sont repris. */
export async function cancelValidation(db: PrismaClient, actor: Actor, taskId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: { project: true, assignments: true, _count: { select: { submissions: true } } },
    })
    if (!task) throw new NotFoundError('Tâche')

    const ctx: TaskContext = {
      status: task.status as TaskStatus,
      participantCount: task.assignments.length,
      hasSubmission: task._count.submissions > 0,
      projectArchived: task.project.status === 'ARCHIVE',
      isParticipant: false,
      actorRole: actor.role,
    }
    const status = nextStatus(ctx, 'ANNULER_VALIDATION')

    const entries = await tx.pointsEntry.findMany({ where: { taskId, reason: 'TACHE' } })
    for (const entry of entries) {
      await tx.pointsEntry.create({
        data: {
          userId: entry.userId,
          projectId: entry.projectId,
          amount: -entry.amount,
          reason: 'ANNULATION',
          taskId,
        },
      })
    }

    await tx.task.update({ where: { id: taskId }, data: { status } })
  })

  await notify(db, actor.id, {
    type: 'VALIDATION_ANNULEE',
    message: 'Validation annulée.',
    link: `/cap/${taskId}`,
  })
}

export async function listPendingSubmissions(db: PrismaClient) {
  return db.submission.findMany({
    where: { decision: null },
    orderBy: { createdAt: 'asc' },
    include: {
      submittedBy: { select: { displayName: true } },
      attachments: true,
      task: { include: { assignments: { include: { user: { select: { displayName: true } } } } } },
    },
  })
}
```

- [ ] **Step 4: Lancer les tests**

Run: `pnpm test tests/integration/submissions.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Lancer toute la suite**

Run: `pnpm test`
Expected: PASS, tous les tests des tâches 1 à 12.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/submissionService.ts tests/integration/submissions.test.ts
git commit -m "feat: soumission des tâches et revue par les chefs"
```

---

### Task 13: Rôles du CAP

**Files:**
- Create: `src/lib/services/roleService.ts`
- Test: `tests/integration/roles.test.ts`

**Interfaces:**
- Consumes: `creditPoints` (T8), `refreshBadges` (T9), `notify` (T8).
- Produces: `createRole`, `applyToRole`, `decideApplication`, `closeRole`, `listRoles`.

- [ ] **Step 1: Écrire le test d'intégration**

```ts
// tests/integration/roles.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { getScore } from '@/lib/services/pointsService'
import { createProject } from '@/lib/services/projectService'
import { applyToRole, closeRole, createRole, decideApplication, listRoles } from '@/lib/services/roleService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('rôles du CAP', () => {
  let t: TestDb
  let chef: Actor
  let lucie: Actor
  let tom: Actor
  let projectId: string

  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    tom = await mk('tom', 'JEUNE')
    projectId = (await createProject(t.prisma, chef, { title: 'Camp 2027' })).id
    await t.prisma.badge.create({
      data: { code: 'responsable', name: 'Responsable', description: 'un rôle tenu', icon: '🎖️', ruleType: 'ROLE_CLOTURE', threshold: 1, points: 15 },
    })
  })
  afterEach(async () => { await t.cleanup() })

  const roleTresorier = () => createRole(t.prisma, chef, { projectId, name: 'Trésorier', points: 60 })

  it('crée un rôle, réservé aux chefs', async () => {
    const role = await roleTresorier()
    expect(role.name).toBe('Trésorier')
    await expect(createRole(t.prisma, lucie, { projectId, name: 'Chef secret', points: 1 })).rejects.toThrow()
  })

  it('enregistre une candidature et prévient les chefs', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    expect(await t.prisma.roleApplication.count({ where: { projectRoleId: role.id } })).toBe(1)
    expect(await t.prisma.notification.count({ where: { userId: chef.id, type: 'CANDIDATURE' } })).toBe(1)
  })

  it('refuse deux candidatures du même jeune', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await expect(applyToRole(t.prisma, lucie, role.id)).rejects.toThrow(/déjà/)
  })

  it('attribue le rôle à un candidat et refuse automatiquement les autres', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await applyToRole(t.prisma, tom, role.id)

    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })

    const apres = await t.prisma.projectRole.findUniqueOrThrow({
      where: { id: role.id },
      include: { applications: true },
    })
    expect(apres.holderId).toBe(lucie.id)
    expect(apres.applications.find((a) => a.userId === lucie.id)!.status).toBe('ACCEPTEE')
    expect(apres.applications.find((a) => a.userId === tom.id)!.status).toBe('REFUSEE')
    expect(await t.prisma.notification.count({ where: { userId: tom.id, type: 'CANDIDATURE_REFUSEE' } })).toBe(1)
  })

  it('refuse d attribuer un rôle déjà tenu', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })

    await applyToRole(t.prisma, tom, role.id)
    await expect(decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: tom.id, accept: true }))
      .rejects.toThrow(/déjà tenu/)
  })

  it('verse les points et le badge à la clôture du rôle', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })

    const result = await closeRole(t.prisma, chef, role.id)

    expect(result.awarded).toBe(60)
    expect(result.newBadges).toEqual(['responsable'])
    expect(await getScore(t.prisma, lucie.id)).toBe(75)
  })

  it('refuse de clôturer deux fois ou un rôle sans titulaire', async () => {
    const role = await roleTresorier()
    await expect(closeRole(t.prisma, chef, role.id)).rejects.toThrow(/titulaire/)

    await applyToRole(t.prisma, lucie, role.id)
    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })
    await closeRole(t.prisma, chef, role.id)
    await expect(closeRole(t.prisma, chef, role.id)).rejects.toThrow(/déjà clôturé/)
  })

  it('liste les rôles avec titulaire et candidatures en attente', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, tom, role.id)

    const roles = await listRoles(t.prisma, projectId)
    expect(roles[0].applications.length).toBe(1)
    expect(roles[0].holder).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm test tests/integration/roles.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `src/lib/services/roleService.ts`**

```ts
import type { PrismaClient } from '@prisma/client'
import type { Db } from '@/lib/db'
import type { Actor } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { refreshBadges } from './badgeService'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'
import { notify, notifyMany } from './notificationService'
import { creditPoints } from './pointsService'

export interface CreateRoleInput {
  projectId: string
  name: string
  description?: string
  points: number
}

export async function createRole(db: Db, actor: Actor, input: CreateRoleInput) {
  if (!isChef(actor)) throw new ForbiddenError()
  if (!input.name.trim()) throw new ValidationError('Le nom du rôle est obligatoire.')
  if (input.points < 0) throw new ValidationError('Les points d\'un rôle ne peuvent pas être négatifs.')

  return db.projectRole.create({
    data: {
      projectId: input.projectId,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      points: Math.round(input.points),
    },
  })
}

export async function listRoles(db: Db, projectId: string) {
  return db.projectRole.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: {
      holder: { select: { id: true, displayName: true } },
      applications: {
        where: { status: 'EN_ATTENTE' },
        include: { user: { select: { id: true, displayName: true } } },
      },
    },
  })
}

export async function applyToRole(db: Db, actor: Actor, projectRoleId: string) {
  const role = await db.projectRole.findUnique({ where: { id: projectRoleId }, include: { project: true } })
  if (!role) throw new NotFoundError('Rôle')
  if (role.project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé.')
  if (role.holderId) throw new ValidationError('Ce rôle est déjà tenu.')

  const existing = await db.roleApplication.findUnique({
    where: { projectRoleId_userId: { projectRoleId, userId: actor.id } },
  })
  if (existing) throw new ValidationError('Tu as déjà posé ta candidature pour ce rôle.')

  const application = await db.roleApplication.create({ data: { projectRoleId, userId: actor.id } })

  const chefs = await db.user.findMany({
    where: { role: { in: ['CHEF', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  })
  await notifyMany(db, chefs.map((c) => c.id), {
    type: 'CANDIDATURE',
    message: `${actor.displayName} se porte candidat au rôle de ${role.name}`,
    link: '/roles',
  })

  return application
}

export interface DecideApplicationInput {
  projectRoleId: string
  userId: string
  accept: boolean
}

export async function decideApplication(db: PrismaClient, actor: Actor, input: DecideApplicationInput) {
  if (!isChef(actor)) throw new ForbiddenError()

  return db.$transaction(async (tx) => {
    const role = await tx.projectRole.findUnique({
      where: { id: input.projectRoleId },
      include: { applications: true },
    })
    if (!role) throw new NotFoundError('Rôle')
    if (input.accept && role.holderId) throw new ValidationError('Ce rôle est déjà tenu.')

    if (!input.accept) {
      await tx.roleApplication.updateMany({
        where: { projectRoleId: role.id, userId: input.userId },
        data: { status: 'REFUSEE', decidedById: actor.id },
      })
      await notify(tx, input.userId, {
        type: 'CANDIDATURE_REFUSEE',
        message: `Ta candidature au rôle de ${role.name} n'a pas été retenue.`,
        link: '/roles',
      })
      return role
    }

    await tx.roleApplication.updateMany({
      where: { projectRoleId: role.id, userId: input.userId },
      data: { status: 'ACCEPTEE', decidedById: actor.id },
    })
    await tx.roleApplication.updateMany({
      where: { projectRoleId: role.id, userId: { not: input.userId }, status: 'EN_ATTENTE' },
      data: { status: 'REFUSEE', decidedById: actor.id },
    })

    const updated = await tx.projectRole.update({
      where: { id: role.id },
      data: { holderId: input.userId },
    })

    await notify(tx, input.userId, {
      type: 'ROLE_ATTRIBUE',
      message: `Tu es maintenant ${role.name} du CAP !`,
      link: '/roles',
    })
    const recales = role.applications.filter((a) => a.userId !== input.userId && a.status === 'EN_ATTENTE')
    await notifyMany(tx, recales.map((a) => a.userId), {
      type: 'CANDIDATURE_REFUSEE',
      message: `Le rôle de ${role.name} a été confié à quelqu'un d'autre.`,
      link: '/roles',
    })

    return updated
  })
}

export async function closeRole(db: PrismaClient, actor: Actor, projectRoleId: string) {
  if (!isChef(actor)) throw new ForbiddenError()

  const role = await db.projectRole.findUnique({ where: { id: projectRoleId } })
  if (!role) throw new NotFoundError('Rôle')
  if (role.closedAt) throw new ValidationError('Ce rôle est déjà clôturé.')
  if (!role.holderId) throw new ValidationError('Ce rôle n\'a pas de titulaire.')

  const holderId = role.holderId

  await db.$transaction(async (tx) => {
    await tx.projectRole.update({ where: { id: role.id }, data: { closedAt: new Date() } })
    if (role.points > 0) {
      await creditPoints(tx, {
        userId: holderId,
        projectId: role.projectId,
        amount: role.points,
        reason: 'ROLE',
        projectRoleId: role.id,
      })
    }
  })

  const newBadges = await refreshBadges(db, holderId, role.projectId)

  await notify(db, holderId, {
    type: 'ROLE_CLOTURE',
    message: `Ton rôle de ${role.name} est terminé : ${role.points} points pour toi !`,
    link: '/profil',
  })

  return { awarded: role.points, newBadges }
}
```

- [ ] **Step 4: Lancer les tests**

Run: `pnpm test tests/integration/roles.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/roleService.ts tests/integration/roles.test.ts
git commit -m "feat: rôles du CAP, candidatures et clôture"
```

---

### Task 14: Comptes, authentification et amorçage

**Files:**
- Create: `src/lib/services/userService.ts`, `prisma/seed.ts`
- Modify: `package.json` (bloc `prisma.seed`)
- Test: `tests/integration/users.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword`, `generateTempPassword`, `assertPasswordAcceptable`, `loginThrottle` (T6) ; `destroyUserSessions` (T7).
- Produces:
  - `createUser(db, actor, input): Promise<{ user; tempPassword: string }>`
  - `authenticate(db, username, password): Promise<AuthenticatedUser>` — lève `AuthError`
  - `changeOwnPassword(db, actor, current, next): Promise<void>`
  - `resetPassword(db, actor, userId): Promise<string>`
  - `setActive(db, actor, userId, active): Promise<void>`
  - `listMembers(db)`
  - `pnpm exec prisma db seed` crée le super admin, les badges et le catalogue.

- [ ] **Step 1: Écrire le test d'intégration**

```ts
// tests/integration/users.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loginThrottle } from '@/lib/auth/throttle'
import type { Actor } from '@/lib/domain/types'
import {
  AuthError,
  authenticate,
  changeOwnPassword,
  createUser,
  listMembers,
  resetPassword,
  setActive,
} from '@/lib/services/userService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('comptes', () => {
  let t: TestDb
  let admin: Actor
  let chef: Actor

  beforeEach(async () => {
    t = createTestDb()
    const u = await t.prisma.user.create({
      data: { username: 'admin', displayName: 'Admin', passwordHash: 'x', role: 'SUPER_ADMIN' },
    })
    admin = { id: u.id, role: 'SUPER_ADMIN', displayName: 'Admin' }
    const c = await t.prisma.user.create({
      data: { username: 'sarah', displayName: 'Sarah', passwordHash: 'x', role: 'CHEF' },
    })
    chef = { id: c.id, role: 'CHEF', displayName: 'Sarah' }
    loginThrottle.reset('lucie')
  })
  afterEach(async () => { await t.cleanup() })

  it('crée un jeune avec un mot de passe provisoire à changer', async () => {
    const { user, tempPassword } = await createUser(t.prisma, admin, {
      username: 'Lucie', displayName: 'Lucie M.', role: 'JEUNE',
    })
    expect(user.username).toBe('lucie')
    expect(user.mustChangePassword).toBe(true)
    expect(tempPassword.length).toBeGreaterThanOrEqual(10)
    expect(user.passwordHash).not.toContain(tempPassword)
  })

  // Review Focus 5
  it('refuse un identifiant déjà pris, même avec une autre casse', async () => {
    await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    await expect(createUser(t.prisma, admin, { username: 'LUCIE', displayName: 'Lucie B.', role: 'JEUNE' }))
      .rejects.toThrow(/identifiant/i)
  })

  it('refuse un identifiant vide ou avec des espaces', async () => {
    await expect(createUser(t.prisma, admin, { username: '  ', displayName: 'X', role: 'JEUNE' })).rejects.toThrow()
    await expect(createUser(t.prisma, admin, { username: 'a b', displayName: 'X', role: 'JEUNE' })).rejects.toThrow()
  })

  it('réserve la création de comptes au super admin', async () => {
    await expect(createUser(t.prisma, chef, { username: 'tom', displayName: 'Tom', role: 'JEUNE' }))
      .rejects.toThrow()
  })

  it('connecte avec le bon mot de passe, quelle que soit la casse de l identifiant', async () => {
    const { tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    const session = await authenticate(t.prisma, 'LUCIE', tempPassword)
    expect(session).toMatchObject({ displayName: 'Lucie', role: 'JEUNE', mustChangePassword: true })
  })

  it('refuse un mauvais mot de passe et un compte inconnu, avec le même message', async () => {
    const { tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    await expect(authenticate(t.prisma, 'lucie', 'faux')).rejects.toBeInstanceOf(AuthError)
    await expect(authenticate(t.prisma, 'inconnu', tempPassword)).rejects.toThrow('Identifiant ou mot de passe incorrect.')
  })

  it('refuse la connexion d un compte désactivé', async () => {
    const { user, tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    await setActive(t.prisma, admin, user.id, false)
    await expect(authenticate(t.prisma, 'lucie', tempPassword)).rejects.toBeInstanceOf(AuthError)
  })

  it('bloque après trop d échecs puis débloque après une réussite', async () => {
    const { tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    for (let i = 0; i < 10; i += 1) {
      await expect(authenticate(t.prisma, 'lucie', 'faux')).rejects.toThrow()
    }
    await expect(authenticate(t.prisma, 'lucie', tempPassword)).rejects.toThrow(/trop de tentatives/i)

    loginThrottle.reset('lucie')
    await expect(authenticate(t.prisma, 'lucie', tempPassword)).resolves.toBeTruthy()
  })

  it('change son mot de passe et lève le drapeau', async () => {
    const { user, tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    const lucie: Actor = { id: user.id, role: 'JEUNE', displayName: 'Lucie' }

    await expect(changeOwnPassword(t.prisma, lucie, 'mauvais', 'nouveaumdp1')).rejects.toThrow()
    await expect(changeOwnPassword(t.prisma, lucie, tempPassword, 'court')).rejects.toThrow(/8 caractères/)

    await changeOwnPassword(t.prisma, lucie, tempPassword, 'nouveaumdp1')
    const apres = await authenticate(t.prisma, 'lucie', 'nouveaumdp1')
    expect(apres.mustChangePassword).toBe(false)
  })

  it('laisse un chef réinitialiser le mot de passe d un jeune et coupe ses sessions', async () => {
    const { user } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    await t.prisma.session.create({
      data: { id: 'session-test', userId: user.id, expiresAt: new Date(Date.now() + 100_000) },
    })

    const nouveau = await resetPassword(t.prisma, chef, user.id)

    expect(await t.prisma.session.count({ where: { userId: user.id } })).toBe(0)
    const session = await authenticate(t.prisma, 'lucie', nouveau)
    expect(session.mustChangePassword).toBe(true)
  })

  it('interdit à un chef de réinitialiser le mot de passe d un autre chef', async () => {
    const autre = await t.prisma.user.create({
      data: { username: 'marc', displayName: 'Marc', passwordHash: 'x', role: 'CHEF' },
    })
    await expect(resetPassword(t.prisma, chef, autre.id)).rejects.toThrow()
    await expect(resetPassword(t.prisma, admin, autre.id)).resolves.toBeTruthy()
  })

  it('liste les membres actifs et désactivés, jeunes d abord', async () => {
    await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    const membres = await listMembers(t.prisma)
    expect(membres.map((m) => m.displayName)).toEqual(['Lucie', 'Admin', 'Sarah'])
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm test tests/integration/users.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `src/lib/services/userService.ts`**

```ts
import type { Db } from '@/lib/db'
import { assertPasswordAcceptable, generateTempPassword, hashPassword, verifyPassword } from '@/lib/auth/password'
import { destroyUserSessions } from '@/lib/auth/session'
import { loginThrottle } from '@/lib/auth/throttle'
import type { Actor, AppRole } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

export interface CreateUserInput {
  username: string
  displayName: string
  role: AppRole
}

export interface AuthenticatedUser extends Actor {
  mustChangePassword: boolean
}

export class AuthError extends Error {
  constructor(message = 'Identifiant ou mot de passe incorrect.') {
    super(message)
    this.name = 'AuthError'
  }
}

/** Les identifiants sont stockés en minuscules : l'unicité et la connexion ignorent la casse. */
function normalize(username: string): string {
  return username.trim().toLowerCase()
}

export async function createUser(db: Db, actor: Actor, input: CreateUserInput) {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Seul le super admin peut créer des comptes.')

  const username = normalize(input.username)
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new ValidationError(
      'L\'identifiant doit faire 3 à 30 caractères, sans espace ni accent (lettres, chiffres, point, tiret).',
    )
  }
  if (!input.displayName.trim()) throw new ValidationError('Le nom affiché est obligatoire.')

  if (await db.user.findUnique({ where: { username } })) {
    throw new ValidationError(`L'identifiant « ${username} » est déjà pris.`)
  }

  const tempPassword = generateTempPassword()
  const user = await db.user.create({
    data: {
      username,
      displayName: input.displayName.trim(),
      role: input.role,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    },
  })

  return { user, tempPassword }
}

export async function authenticate(db: Db, username: string, password: string): Promise<AuthenticatedUser> {
  const key = normalize(username)
  if (loginThrottle.isBlocked(key)) {
    throw new AuthError('Trop de tentatives. Réessaie dans un quart d\'heure ou préviens un chef.')
  }

  const user = await db.user.findUnique({ where: { username: key } })
  const ok = user?.isActive === true && (await verifyPassword(user.passwordHash, password))

  if (!ok || !user) {
    loginThrottle.registerFailure(key)
    throw new AuthError()
  }

  loginThrottle.reset(key)
  return {
    id: user.id,
    role: user.role as AppRole,
    displayName: user.displayName,
    mustChangePassword: user.mustChangePassword,
  }
}

export async function changeOwnPassword(db: Db, actor: Actor, current: string, next: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: actor.id } })
  if (!user) throw new NotFoundError('Compte')
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw new ValidationError('Le mot de passe actuel est incorrect.')
  }
  assertPasswordAcceptable(next)

  await db.user.update({
    where: { id: actor.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  })
}

/** Un chef réinitialise le mot de passe d'un jeune ; le super admin, celui de n'importe qui. */
export async function resetPassword(db: Db, actor: Actor, userId: string): Promise<string> {
  const target = await db.user.findUnique({ where: { id: userId } })
  if (!target) throw new NotFoundError('Compte')

  const allowed = actor.role === 'SUPER_ADMIN' || (actor.role === 'CHEF' && target.role === 'JEUNE')
  if (!allowed) throw new ForbiddenError('Tu ne peux réinitialiser que le mot de passe d\'un jeune.')

  const tempPassword = generateTempPassword()
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  })
  // L'ancien mot de passe ne doit plus donner accès à rien.
  await destroyUserSessions(db, userId)

  return tempPassword
}

export async function setActive(db: Db, actor: Actor, userId: string, active: boolean): Promise<void> {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Seul le super admin peut activer ou désactiver un compte.')
  if (userId === actor.id) throw new ValidationError('Tu ne peux pas désactiver ton propre compte.')

  await db.user.update({ where: { id: userId }, data: { isActive: active } })
  if (!active) await destroyUserSessions(db, userId)
}

const ROLE_ORDER: Record<AppRole, number> = { JEUNE: 0, SUPER_ADMIN: 1, CHEF: 2 }

export async function listMembers(db: Db) {
  const users = await db.user.findMany({
    select: { id: true, username: true, displayName: true, role: true, isActive: true, mustChangePassword: true },
  })
  return users.sort(
    (a, b) =>
      ROLE_ORDER[a.role as AppRole] - ROLE_ORDER[b.role as AppRole] ||
      a.displayName.localeCompare(b.displayName, 'fr'),
  )
}
```

- [ ] **Step 4: Lancer les tests**

Run: `pnpm test tests/integration/users.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Écrire `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'

const prisma = new PrismaClient()

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
    await prisma.badge.upsert({ where: { code: badge.code }, update: badge, create: badge })
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

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
```

Ajouter dans `package.json` :

```json
{
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

et installer `tsx` : `pnpm add -D tsx`.

- [ ] **Step 6: Exécuter l'amorçage et vérifier son idempotence**

```bash
pnpm exec prisma db seed
pnpm exec prisma db seed
```

Expected: aucune erreur, aucun doublon. Vérifier avec `pnpm exec prisma studio` ou :

```bash
pnpm exec prisma db execute --stdin <<< "SELECT count(*) FROM Badge; SELECT count(*) FROM TaskTemplate;"
```

Expected: 10 badges, 22 modèles.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/userService.ts prisma/seed.ts package.json tests/integration/users.test.ts
git commit -m "feat: comptes, authentification et amorçage de la base"
```

---

### Task 15: Connexion et changement de mot de passe forcé

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`, `src/app/profil/mot-de-passe/page.tsx`, `src/app/profil/mot-de-passe/actions.ts`, `src/components/FormError.tsx`, `src/components/SubmitButton.tsx`, `middleware.ts`
- Modify: `src/app/page.tsx` (redirection vers `/accueil`)
- Test: `e2e/connexion.spec.ts` (écrit ici, exécuté en Tâche 22)

**Interfaces:**
- Consumes: `authenticate`, `changeOwnPassword` (T14) ; `createSession`, `destroySession`, `SESSION_COOKIE` (T7) ; `requireUser` (T7).
- Produces:
  - `loginAction(prevState, formData): Promise<FormState>`
  - `logoutAction(): Promise<void>`
  - `changePasswordAction(prevState, formData): Promise<FormState>`
  - `type FormState = { error?: string; success?: string }` dans `src/lib/formState.ts`

- [ ] **Step 1: Écrire `src/lib/formState.ts`**

```ts
export interface FormState {
  error?: string
  success?: string
}

export const EMPTY_FORM_STATE: FormState = {}

/** Transforme une erreur de service en message affichable, sans fuite technique. */
export function toFormError(error: unknown): FormState {
  const known = ['AuthError', 'ValidationError', 'ForbiddenError', 'NotFoundError', 'UploadError',
    'TaskTransitionError', 'AlreadyReviewedError', 'WeakPasswordError', 'DuplicateAwardError']
  if (error instanceof Error && known.includes(error.name)) return { error: error.message }
  console.error(error)
  return { error: 'Une erreur est survenue. Réessaie, et préviens un chef si ça recommence.' }
}
```

- [ ] **Step 2: Écrire `src/app/(auth)/login/actions.ts`**

```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, SESSION_TTL_MS, createSession, destroySession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { authenticate } from '@/lib/services/userService'

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  let mustChangePassword = false
  try {
    const user = await authenticate(db, username, password)
    const { token } = await createSession(db, user.id)
    mustChangePassword = user.mustChangePassword
    ;(await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
  } catch (error) {
    return toFormError(error)
  }

  redirect(mustChangePassword ? '/profil/mot-de-passe' : '/accueil')
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) await destroySession(db, token)
  store.delete(SESSION_COOKIE)
  redirect('/login')
}
```

`redirect()` lève une exception interne à Next : il doit rester **hors** du `try`, sinon `toFormError` l'avale.

- [ ] **Step 3: Écrire `src/app/(auth)/login/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, EMPTY_FORM_STATE)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <p className="text-5xl">⛺</p>
        <h1 className="mt-2 text-2xl font-bold">Notre CAP</h1>
        <p className="text-sm opacity-70">Caravane Pionniers-Caravelles</p>
      </header>

      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Identifiant</span>
          <input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
            className="rounded-lg border p-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Mot de passe</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-lg border p-3 text-base"
          />
        </label>

        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="text-center text-xs opacity-70">
        Mot de passe oublié ? Demande à un chef de t'en donner un nouveau.
      </p>
    </main>
  )
}
```

- [ ] **Step 4: Écrire le changement de mot de passe**

```ts
// src/app/profil/mot-de-passe/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { changeOwnPassword } from '@/lib/services/userService'

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true })
  const current = String(formData.get('current') ?? '')
  const next = String(formData.get('next') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (next !== confirm) return { error: 'Les deux nouveaux mots de passe ne sont pas identiques.' }

  try {
    await changeOwnPassword(db, user, current, next)
  } catch (error) {
    return toFormError(error)
  }

  redirect('/accueil')
}
```

```tsx
// src/app/profil/mot-de-passe/page.tsx
'use client'

import { useActionState } from 'react'
import { EMPTY_FORM_STATE } from '@/lib/formState'
import { changePasswordAction } from './actions'

export default function ChangePasswordPage() {
  const [state, action, pending] = useActionState(changePasswordAction, EMPTY_FORM_STATE)

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">Choisis ton mot de passe</h1>
      <p className="text-sm opacity-70">8 caractères minimum. Ne le partage avec personne.</p>

      <form action={action} className="flex flex-col gap-4">
        <input name="current" type="password" placeholder="Mot de passe actuel" required
          autoComplete="current-password" className="rounded-lg border p-3" />
        <input name="next" type="password" placeholder="Nouveau mot de passe" required minLength={8}
          autoComplete="new-password" className="rounded-lg border p-3" />
        <input name="confirm" type="password" placeholder="Confirme le nouveau" required minLength={8}
          autoComplete="new-password" className="rounded-lg border p-3" />

        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p>
        ) : null}

        <button type="submit" disabled={pending}
          className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
          Enregistrer
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Rediriger la racine**

```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/accueil')
}
```

- [ ] **Step 6: Écrire le test bout en bout (exécuté en Tâche 22)**

```ts
// e2e/connexion.spec.ts
import { expect, test } from '@playwright/test'

test('un jeune se connecte, change son mot de passe et arrive sur l accueil', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Identifiant').fill('lucie')
  await page.getByLabel('Mot de passe').fill('motdepasse-initial')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page).toHaveURL(/\/profil\/mot-de-passe/)
  await page.getByPlaceholder('Mot de passe actuel').fill('motdepasse-initial')
  await page.getByPlaceholder('Nouveau mot de passe').fill('nouveau-mdp-2027')
  await page.getByPlaceholder('Confirme le nouveau').fill('nouveau-mdp-2027')
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page).toHaveURL(/\/accueil/)
})

test('un mauvais mot de passe affiche un message et ne connecte pas', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Identifiant').fill('lucie')
  await page.getByLabel('Mot de passe').fill('faux')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page.getByRole('alert')).toContainText('incorrect')
  await expect(page).toHaveURL(/\/login/)
})
```

- [ ] **Step 7: Vérifier à la main**

```bash
pnpm dev
```

Ouvrir `http://localhost:3000`, se connecter avec le super admin du seed, vérifier la redirection vers le changement de mot de passe puis l'arrivée sur `/accueil` (404 à ce stade, c'est attendu).

- [ ] **Step 8: Commit**

```bash
git add src/app src/lib/formState.ts e2e
git commit -m "feat: connexion, déconnexion et changement de mot de passe forcé"
```

---

### Task 16: Coquille de l'application, accueil et tableau du CAP

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/accueil/page.tsx`, `src/app/(app)/cap/page.tsx`, `src/components/PhaseColumn.tsx`, `src/components/TaskCard.tsx`, `src/components/ProgressBar.tsx`, `src/components/NavBar.tsx`, `src/lib/ui/phases.ts`
- Modify: `src/app/globals.css` (tokens de couleur et thème sombre)
- Test: `tests/unit/phases.test.ts`

**Interfaces:**
- Consumes: `requireUser` (T7), `getActiveProject` (T11), `listBoard` (T11), `getScore` (T8), `countUnread` (T8).
- Produces:
  - `src/lib/ui/phases.ts` : `PHASE_STYLES: Record<Phase, { label; emoji; bg; text; ring }>`, `phaseProgress(tasks): { done, total, percent }`
  - Composants `NavBar`, `TaskCard`, `PhaseColumn`, `ProgressBar`.

- [ ] **Step 1: Écrire le test de progression**

```ts
// tests/unit/phases.test.ts
import { describe, expect, it } from 'vitest'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

describe('phaseProgress', () => {
  it('compte les tâches terminées', () => {
    expect(phaseProgress([{ status: 'TERMINEE' }, { status: 'OUVERTE' }, { status: 'SOUMISE' }]))
      .toEqual({ done: 1, total: 3, percent: 33 })
  })

  it('rend 0 % sans tâche, sans diviser par zéro', () => {
    expect(phaseProgress([])).toEqual({ done: 0, total: 0, percent: 0 })
  })

  it('rend 100 % quand tout est terminé', () => {
    expect(phaseProgress([{ status: 'TERMINEE' }, { status: 'TERMINEE' }]).percent).toBe(100)
  })
})

describe('PHASE_STYLES', () => {
  it('couvre les trois phases avec un libellé français', () => {
    expect(Object.keys(PHASE_STYLES)).toEqual(['CHOISIR', 'AGIR', 'PARTAGER'])
    expect(PHASE_STYLES.PARTAGER.label).toBe('Partager')
  })
})
```

- [ ] **Step 2: Écrire `src/lib/ui/phases.ts`**

```ts
import type { Phase, TaskStatus } from '@/lib/domain/types'

export const PHASE_STYLES: Record<Phase, { label: string; emoji: string; bg: string; text: string; ring: string }> = {
  CHOISIR: { label: 'Choisir', emoji: '💡', bg: 'bg-amber-100', text: 'text-amber-900', ring: 'ring-amber-400' },
  AGIR: { label: 'Agir', emoji: '🔨', bg: 'bg-sky-100', text: 'text-sky-900', ring: 'ring-sky-400' },
  PARTAGER: { label: 'Partager', emoji: '🎉', bg: 'bg-fuchsia-100', text: 'text-fuchsia-900', ring: 'ring-fuchsia-400' },
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  PROPOSEE: 'Proposée',
  REJETEE: 'Non retenue',
  OUVERTE: 'À prendre',
  EN_COURS: 'En cours',
  SOUMISE: 'En attente de validation',
  A_CORRIGER: 'À corriger',
  TERMINEE: 'Terminée',
}

export function phaseProgress(tasks: { status: string }[]): { done: number; total: number; percent: number } {
  const total = tasks.length
  const done = tasks.filter((task) => task.status === 'TERMINEE').length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}
```

- [ ] **Step 3: Lancer le test**

Run: `pnpm test tests/unit/phases.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4: Écrire la coquille `src/app/(app)/layout.tsx`**

```tsx
import type { ReactNode } from 'react'
import { NavBar } from '@/components/NavBar'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { isChef } from '@/lib/domain/types'
import { countUnread } from '@/lib/services/notificationService'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  const unread = await countUnread(db, user.id)

  return (
    <div className="min-h-dvh bg-stone-50 pb-20 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto max-w-3xl p-4">{children}</main>
      <NavBar role={user.role} isChef={isChef(user)} unread={unread} />
    </div>
  )
}
```

- [ ] **Step 5: Écrire `src/components/NavBar.tsx`**

```tsx
import Link from 'next/link'
import type { AppRole } from '@/lib/domain/types'

interface Props {
  role: AppRole
  isChef: boolean
  unread: number
}

export function NavBar({ role, isChef, unread }: Props) {
  const links = [
    { href: '/accueil', label: 'Accueil', emoji: '🏠' },
    { href: '/cap', label: 'Le CAP', emoji: '🗺️' },
    { href: '/roles', label: 'Rôles', emoji: '🎖️' },
    { href: '/classement', label: 'Classement', emoji: '🏆' },
    ...(isChef ? [{ href: '/validation', label: 'Valider', emoji: '✅' }] : []),
    ...(role === 'SUPER_ADMIN' ? [{ href: '/comptes', label: 'Comptes', emoji: '👥' }] : []),
    { href: '/profil', label: 'Profil', emoji: '🙂' },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t bg-white/95 backdrop-blur dark:bg-stone-900/95">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {links.map((link) => (
          <li key={link.href} className="flex-1">
            <Link href={link.href} className="flex flex-col items-center gap-0.5 p-2 text-[11px]">
              <span className="relative text-xl" aria-hidden>
                {link.emoji}
                {link.href === '/accueil' && unread > 0 ? (
                  <span className="absolute -right-2 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </span>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 6: Écrire `src/components/ProgressBar.tsx` et `src/components/TaskCard.tsx`**

```tsx
// src/components/ProgressBar.tsx
export function ProgressBar({ percent, className = '' }: { percent: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-3 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800 ${className}`}
    >
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
    </div>
  )
}
```

```tsx
// src/components/TaskCard.tsx
import Link from 'next/link'
import type { Difficulty, TaskStatus } from '@/lib/domain/types'
import { DIFFICULTY_LABELS } from '@/lib/domain/types'
import { STATUS_LABELS } from '@/lib/ui/phases'

interface Props {
  task: {
    id: string
    title: string
    status: string
    difficulty: string
    assignments: { user: { id: string; displayName: string } }[]
  }
  currentUserId: string
}

export function TaskCard({ task, currentUserId }: Props) {
  const mine = task.assignments.some((a) => a.user.id === currentUserId)

  return (
    <Link
      href={`/cap/${task.id}`}
      className={`block rounded-xl border bg-white p-3 shadow-sm dark:bg-stone-900 ${mine ? 'ring-2 ring-emerald-400' : ''}`}
    >
      <p className="font-semibold">{task.title}</p>
      <p className="mt-1 text-xs opacity-70">
        {DIFFICULTY_LABELS[task.difficulty as Difficulty]} · {STATUS_LABELS[task.status as TaskStatus]}
      </p>
      {task.assignments.length > 0 ? (
        <p className="mt-2 text-xs">
          {task.assignments.map((a) => a.user.displayName).join(', ')}
        </p>
      ) : (
        <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">Personne dessus pour l'instant</p>
      )}
    </Link>
  )
}
```

- [ ] **Step 7: Écrire `src/app/(app)/cap/page.tsx`**

```tsx
import { PhaseColumn } from '@/components/PhaseColumn'
import { ProgressBar } from '@/components/ProgressBar'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES } from '@/lib/domain/types'
import { listBoard } from '@/lib/services/taskService'
import { getActiveProject } from '@/lib/services/projectService'
import { phaseProgress } from '@/lib/ui/phases'

export default async function CapPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)
  if (!project) {
    return <p className="p-4">Aucun CAP en cours. Un chef doit en démarrer un.</p>
  }

  const board = await listBoard(db, project.id)
  const all = PHASES.flatMap((phase) => board[phase])
  const global = phaseProgress(all)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="mt-1 text-sm opacity-70">
          {global.done} tâches terminées sur {global.total}
        </p>
        <ProgressBar percent={global.percent} className="mt-2" />
      </header>

      {PHASES.map((phase) => (
        <PhaseColumn
          key={phase}
          phase={phase}
          tasks={board[phase]}
          currentUserId={user.id}
          isCurrentPhase={project.currentPhase === phase}
        />
      ))}
    </div>
  )
}
```

```tsx
// src/components/PhaseColumn.tsx
import { TaskCard } from '@/components/TaskCard'
import { ProgressBar } from '@/components/ProgressBar'
import type { Phase } from '@/lib/domain/types'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

interface Props {
  phase: Phase
  tasks: Parameters<typeof TaskCard>[0]['task'][]
  currentUserId: string
  isCurrentPhase: boolean
}

export function PhaseColumn({ phase, tasks, currentUserId, isCurrentPhase }: Props) {
  const style = PHASE_STYLES[phase]
  const progress = phaseProgress(tasks)

  return (
    <section className={`rounded-2xl p-4 ${style.bg} ${style.text} ${isCurrentPhase ? `ring-2 ${style.ring}` : ''}`}>
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">
          <span aria-hidden>{style.emoji}</span> {style.label}
        </h2>
        <span className="text-sm">{progress.done}/{progress.total}</span>
      </header>
      <ProgressBar percent={progress.percent} className="my-3" />

      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-sm opacity-70">Aucune tâche dans cette phase pour l'instant.</p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} currentUserId={currentUserId} />)
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 8: Écrire `src/app/(app)/accueil/page.tsx`**

Tableau de bord : mes tâches en cours, mon score, mes derniers badges, mes notifications non lues.

```tsx
import Link from 'next/link'
import { ProgressBar } from '@/components/ProgressBar'
import { TaskCard } from '@/components/TaskCard'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getScore } from '@/lib/services/pointsService'
import { getActiveProject } from '@/lib/services/projectService'
import { listNotifications } from '@/lib/services/notificationService'
import { listBoard } from '@/lib/services/taskService'
import { PHASES } from '@/lib/domain/types'
import { phaseProgress } from '@/lib/ui/phases'

export default async function AccueilPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)

  const [score, notifications, badges] = await Promise.all([
    getScore(db, user.id),
    listNotifications(db, user.id, 5),
    db.userBadge.findMany({ where: { userId: user.id }, include: { badge: true }, orderBy: { earnedAt: 'desc' }, take: 6 }),
  ])

  const board = project ? await listBoard(db, project.id) : null
  const mesTaches = board
    ? PHASES.flatMap((phase) => board[phase]).filter(
        (task) => task.assignments.some((a) => a.user.id === user.id) && task.status !== 'TERMINEE',
      )
    : []
  const progress = board ? phaseProgress(PHASES.flatMap((phase) => board[phase])) : { percent: 0, done: 0, total: 0 }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-emerald-600 p-5 text-white">
        <p className="text-sm opacity-90">Salut {user.displayName} !</p>
        <p className="text-4xl font-black">{score} pts</p>
        {project ? (
          <>
            <p className="mt-3 text-sm">{project.title} · {progress.done}/{progress.total} tâches</p>
            <ProgressBar percent={progress.percent} className="mt-1" />
          </>
        ) : null}
      </header>

      <section>
        <h2 className="mb-2 text-lg font-bold">Mes tâches en cours</h2>
        {mesTaches.length === 0 ? (
          <p className="text-sm opacity-70">
            Tu n'as rien en cours. <Link href="/cap" className="underline">Va prendre une tâche !</Link>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mesTaches.map((task) => <TaskCard key={task.id} task={task} currentUserId={user.id} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Mes badges</h2>
        {badges.length === 0 ? (
          <p className="text-sm opacity-70">Aucun badge pour l'instant. Le premier arrive dès ta première tâche validée.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <li key={b.id} title={b.badge.description} className="rounded-xl bg-white p-2 text-center shadow-sm dark:bg-stone-900">
                <span className="text-2xl" aria-hidden>{b.badge.icon}</span>
                <p className="text-[11px]">{b.badge.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Dernières nouvelles</h2>
        <ul className="flex flex-col gap-2">
          {notifications.length === 0 ? <li className="text-sm opacity-70">Rien de neuf.</li> : null}
          {notifications.map((n) => (
            <li key={n.id} className={`rounded-xl border p-3 text-sm ${n.readAt ? 'opacity-60' : 'font-medium'}`}>
              <Link href={n.link}>{n.message}</Link>
            </li>
          ))}
        </ul>
        <Link href="/notifications" className="mt-2 inline-block text-sm underline">Tout voir</Link>
      </section>
    </div>
  )
}
```

- [ ] **Step 9: Écrire les couleurs et le thème sombre dans `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-choisir: oklch(0.84 0.13 85);
  --color-agir: oklch(0.80 0.12 230);
  --color-partager: oklch(0.80 0.15 330);
}

:root {
  color-scheme: light dark;
}

html {
  -webkit-text-size-adjust: 100%;
}

/* Les jeunes sont sur téléphone : pas de zoom involontaire sur les champs. */
input,
textarea,
select {
  font-size: 16px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Tailwind 4 gère le thème sombre via `dark:` et `prefers-color-scheme` : les classes `dark:` déjà posées sur les composants suffisent, aucun bascule manuel n'est prévu.

- [ ] **Step 10: Écrire l'animation de validation `src/components/Celebration.tsx`**

Spec §13 : une tâche validée doit se fêter. Le composant se déclenche une seule fois par
notification, et ne fait rien si le système demande moins d'animations.

```tsx
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
```

Le brancher sur l'accueil : passer en `trigger` l'identifiant de la notification
`TACHE_VALIDEE` ou `BADGE` non lue la plus récente, ou `null` s'il n'y en a pas.

```tsx
// dans src/app/(app)/accueil/page.tsx, après le chargement des notifications
const fete = notifications.find((n) => !n.readAt && ['TACHE_VALIDEE', 'BADGE'].includes(n.type))
// puis, dans le JSX :
// <Celebration trigger={fete?.id ?? null} />
```

- [ ] **Step 11: Vérifier à la main**

```bash
pnpm dev
```

Se connecter, vérifier `/accueil` et `/cap` sur une fenêtre étroite (mode mobile des outils de
développement), en thème clair puis en thème sombre (réglage du système).

- [ ] **Step 12: Commit**

```bash
git add src/app src/components src/lib/ui tests/unit/phases.test.ts
git commit -m "feat: coquille de l'application, accueil et tableau du CAP"
```

---

### Task 17: Détail d'une tâche, inscription et soumission avec photos

**Files:**
- Create: `src/app/(app)/cap/[taskId]/page.tsx`, `src/app/(app)/cap/[taskId]/actions.ts`, `src/components/SubmissionThread.tsx`, `src/components/SubmitWorkForm.tsx`, `src/app/api/fichiers/[id]/route.ts`
- Test: `tests/integration/fichiers.test.ts`

**Interfaces:**
- Consumes: `getTaskDetail`, `joinTask`, `leaveTask` (T11) ; `submitTask` (T12) ; `readPhoto` (T10) ; `requireUser` (T7).
- Produces: `joinAction`, `leaveAction`, `submitAction` ; route `GET /api/fichiers/[id]` qui sert une photo après contrôle de session.

- [ ] **Step 1: Écrire les actions**

```ts
// src/app/(app)/cap/[taskId]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { submitTask } from '@/lib/services/submissionService'
import { joinTask, leaveTask } from '@/lib/services/taskService'

export async function joinAction(taskId: string): Promise<FormState> {
  const user = await requireUser()
  try {
    await joinTask(db, user, taskId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath(`/cap/${taskId}`)
  return { success: 'Tu es inscrit sur cette tâche.' }
}

export async function leaveAction(taskId: string): Promise<FormState> {
  const user = await requireUser()
  try {
    await leaveTask(db, user, taskId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath(`/cap/${taskId}`)
  return { success: 'Tu t\'es retiré de cette tâche.' }
}

export async function submitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  const taskId = String(formData.get('taskId') ?? '')
  const message = String(formData.get('message') ?? '')

  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  const photos = await Promise.all(
    files.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
    })),
  )

  try {
    await submitTask(db, user, { taskId, message, photos })
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath(`/cap/${taskId}`)
  return { success: 'C\'est envoyé ! Un chef va regarder ça.' }
}
```

- [ ] **Step 2: Écrire la route de service des photos**

```ts
// src/app/api/fichiers/[id]/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { readPhoto } from '@/lib/storage'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Photos de mineurs : aucune n'est servie sans session valide.
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Non autorisé', { status: 401 })

  const { id } = await params
  const attachment = await db.attachment.findUnique({ where: { id } })
  if (!attachment) return new NextResponse('Introuvable', { status: 404 })

  try {
    const data = await readPhoto(attachment.storedName)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': attachment.mimeType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
      },
    })
  } catch {
    return new NextResponse('Introuvable', { status: 404 })
  }
}
```

- [ ] **Step 3: Écrire le test de la route**

```ts
// tests/integration/fichiers.test.ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/guard', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { attachment: { findUnique: vi.fn() } } }))
vi.mock('@/lib/storage', () => ({ readPhoto: vi.fn() }))

const { getCurrentUser } = await import('@/lib/auth/guard')
const { db } = await import('@/lib/db')
const { readPhoto } = await import('@/lib/storage')
const { GET } = await import('@/app/api/fichiers/[id]/route')

const params = Promise.resolve({ id: 'att-1' })

describe('GET /api/fichiers/[id]', () => {
  it('refuse sans session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const response = await GET(new Request('http://x/api/fichiers/att-1'), { params })
    expect(response.status).toBe(401)
    expect(readPhoto).not.toHaveBeenCalled()
  })

  it('sert la photo à un utilisateur connecté', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'JEUNE', displayName: 'Lucie', mustChangePassword: false })
    vi.mocked(db.attachment.findUnique).mockResolvedValue({
      id: 'att-1', storedName: 'abc.webp', mimeType: 'image/webp', originalName: 'photo.jpg',
    } as never)
    vi.mocked(readPhoto).mockResolvedValue(Buffer.from('image'))

    const response = await GET(new Request('http://x/api/fichiers/att-1'), { params })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toContain('private')
  })

  it('rend 404 si la pièce jointe n existe pas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'JEUNE', displayName: 'Lucie', mustChangePassword: false })
    vi.mocked(db.attachment.findUnique).mockResolvedValue(null as never)

    expect((await GET(new Request('http://x/api/fichiers/att-1'), { params })).status).toBe(404)
  })
})
```

- [ ] **Step 4: Lancer le test**

Run: `pnpm test tests/integration/fichiers.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Écrire le formulaire de soumission**

```tsx
// src/components/SubmitWorkForm.tsx
'use client'

import { useActionState } from 'react'
import { submitAction } from '@/app/(app)/cap/[taskId]/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

export function SubmitWorkForm({ taskId, aCorriger }: { taskId: string; aCorriger: boolean }) {
  const [state, action, pending] = useActionState(submitAction, EMPTY_FORM_STATE)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <h3 className="font-bold">{aCorriger ? 'Renvoyer après correction' : 'J\'ai fini !'}</h3>

      <textarea
        name="message"
        rows={3}
        placeholder="Raconte ce que tu as fait (facultatif)"
        className="rounded-lg border p-3"
      />

      <label className="text-sm">
        Photos (3 maximum, 8 Mo chacune)
        <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple
          className="mt-1 block w-full text-sm" />
      </label>

      {state.error ? <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{state.success}</p> : null}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
        {pending ? 'Envoi…' : 'Soumettre aux chefs'}
      </button>
    </form>
  )
}
```

Augmenter la limite de taille des Server Actions, sinon trois photos de 8 Mo sont refusées par Next avant d'arriver au code :

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '30mb' } },
}

export default nextConfig
```

- [ ] **Step 6: Écrire le fil des soumissions et la page de détail**

```tsx
// src/components/SubmissionThread.tsx
import Image from 'next/image'

interface Submission {
  id: string
  message: string
  createdAt: Date
  decision: string | null
  reviewComment: string | null
  bonusPoints: number
  submittedBy: { displayName: string }
  reviewedBy: { displayName: string } | null
  attachments: { id: string; originalName: string; width: number; height: number }[]
}

export function SubmissionThread({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-bold">Ce qui a été rendu</h3>
      {submissions.map((submission) => (
        <article key={submission.id} className="rounded-2xl border p-4">
          <p className="text-sm">
            <strong>{submission.submittedBy.displayName}</strong> ·{' '}
            {submission.createdAt.toLocaleDateString('fr-FR')}
          </p>
          {submission.message ? <p className="mt-2 whitespace-pre-wrap">{submission.message}</p> : null}

          {submission.attachments.length > 0 ? (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {submission.attachments.map((photo) => (
                <li key={photo.id}>
                  <Image
                    src={`/api/fichiers/${photo.id}`}
                    alt={photo.originalName}
                    width={photo.width}
                    height={photo.height}
                    className="h-24 w-full rounded-lg object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {submission.decision === 'ACCEPTEE' ? (
            <p className="mt-3 rounded-lg bg-emerald-100 p-2 text-sm text-emerald-900">
              ✅ Validée par {submission.reviewedBy?.displayName}
              {submission.bonusPoints > 0 ? ` · bonus de ${submission.bonusPoints} points !` : ''}
              {submission.reviewComment ? ` — ${submission.reviewComment}` : ''}
            </p>
          ) : null}

          {submission.decision === 'REFUSEE' ? (
            <p className="mt-3 rounded-lg bg-amber-100 p-2 text-sm text-amber-900">
              ✏️ À corriger, dit {submission.reviewedBy?.displayName} : {submission.reviewComment}
            </p>
          ) : null}

          {submission.decision === null ? (
            <p className="mt-3 text-sm opacity-70">⏳ En attente de la réponse d'un chef.</p>
          ) : null}
        </article>
      ))}
    </section>
  )
}
```

```tsx
// src/app/(app)/cap/[taskId]/page.tsx
import { SubmissionThread } from '@/components/SubmissionThread'
import { SubmitWorkForm } from '@/components/SubmitWorkForm'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { canPerform } from '@/lib/domain/tasks'
import { DIFFICULTY_LABELS, type Difficulty, type Phase, type TaskStatus } from '@/lib/domain/types'
import { getTaskDetail } from '@/lib/services/taskService'
import { PHASE_STYLES, STATUS_LABELS } from '@/lib/ui/phases'
import { joinAction, leaveAction } from './actions'

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireUser()
  const { taskId } = await params
  const task = await getTaskDetail(db, taskId)

  const ctx = {
    status: task.status as TaskStatus,
    participantCount: task.assignments.length,
    hasSubmission: task.submissions.length > 0,
    projectArchived: task.project.status === 'ARCHIVE',
    isParticipant: task.assignments.some((a) => a.user.id === user.id),
    actorRole: user.role,
  }
  const style = PHASE_STYLES[task.phase as Phase]

  return (
    <div className="flex flex-col gap-5">
      <header className={`rounded-2xl p-4 ${style.bg} ${style.text}`}>
        <p className="text-sm">{style.emoji} {style.label} · {DIFFICULTY_LABELS[task.difficulty as Difficulty]}</p>
        <h1 className="mt-1 text-xl font-bold">{task.title}</h1>
        <p className="mt-1 text-sm">{STATUS_LABELS[task.status as TaskStatus]}</p>
      </header>

      {task.description ? <p className="whitespace-pre-wrap">{task.description}</p> : null}

      <section>
        <h2 className="font-bold">Qui s'en occupe</h2>
        {task.assignments.length === 0 ? (
          <p className="text-sm opacity-70">Personne pour l'instant.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2">
            {task.assignments.map((a) => (
              <li key={a.user.id} className="rounded-full bg-stone-200 px-3 py-1 text-sm dark:bg-stone-800">
                {a.user.displayName}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-2">
        {canPerform(ctx, 'S_INSCRIRE') ? (
          <form action={joinAction.bind(null, task.id)}>
            <button className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white">Je m'inscris</button>
          </form>
        ) : null}

        {canPerform(ctx, 'SE_DESINSCRIRE') ? (
          <form action={leaveAction.bind(null, task.id)}>
            <button className="rounded-lg border px-4 py-3">Me retirer</button>
          </form>
        ) : null}
      </div>

      {canPerform(ctx, 'SOUMETTRE') ? (
        <SubmitWorkForm taskId={task.id} aCorriger={task.status === 'A_CORRIGER'} />
      ) : null}

      <SubmissionThread submissions={task.submissions} />
    </div>
  )
}
```

`canPerform` n'est utilisé ici que pour afficher ou masquer les boutons. L'autorisation réelle reste celle du service, appelé par l'action.

- [ ] **Step 7: Vérifier à la main**

Créer une tâche en base (`pnpm exec prisma studio`), s'inscrire, soumettre avec une photo, vérifier que la photo s'affiche et qu'elle renvoie 401 en navigation privée.

- [ ] **Step 8: Commit**

```bash
git add src/app src/components next.config.ts tests/integration/fichiers.test.ts
git commit -m "feat: détail d'une tâche, inscription et soumission avec photos"
```

---

### Task 18: File de validation et création de tâches

**Files:**
- Create: `src/app/(chef)/validation/page.tsx`, `src/app/(chef)/validation/actions.ts`, `src/components/ReviewCard.tsx`, `src/app/(chef)/taches/page.tsx`, `src/app/(chef)/taches/actions.ts`, `src/components/NewTaskForm.tsx`
- Test: `tests/integration/validationActions.test.ts`

**Interfaces:**
- Consumes: `requireChef` (T7) ; `listPendingSubmissions`, `reviewSubmission` (T12) ; `decideProposal`, `createTask` (T11) ; `maxBonus` (T3).
- Produits : `reviewAction`, `proposalAction`, `createTaskAction`, `createFromTemplateAction`, `saveAsTemplateAction`.

- [ ] **Step 1: Écrire les actions de validation**

```ts
// src/app/(chef)/validation/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { reviewSubmission } from '@/lib/services/submissionService'
import { decideProposal } from '@/lib/services/taskService'

export async function reviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  const submissionId = String(formData.get('submissionId') ?? '')
  const accept = formData.get('decision') === 'ACCEPTEE'

  try {
    const result = await reviewSubmission(db, chef, {
      submissionId,
      decision: accept ? 'ACCEPTEE' : 'REFUSEE',
      comment: String(formData.get('comment') ?? ''),
      bonus: Number(formData.get('bonus') ?? 0),
    })
    revalidatePath('/validation')
    revalidatePath('/cap')
    return {
      success: accept
        ? `Validée ! ${result.awarded.length} jeune(s) crédité(s) de ${result.awarded[0]?.amount ?? 0} points.`
        : 'Renvoyée au jeune pour correction.',
    }
  } catch (error) {
    return toFormError(error)
  }
}

export async function proposalAction(taskId: string, accept: boolean): Promise<FormState> {
  const chef = await requireChef()
  try {
    await decideProposal(db, chef, taskId, accept)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/validation')
  revalidatePath('/cap')
  return { success: accept ? 'Proposition acceptée.' : 'Proposition écartée.' }
}
```

- [ ] **Step 2: Écrire le test des actions**

```ts
// tests/integration/validationActions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createTestDb, type TestDb } from '../helpers/db'

let t: TestDb
let chef: Actor
let lucie: Actor
let currentUser: Actor

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/guard', () => ({
  requireChef: async () => {
    if (currentUser.role === 'JEUNE') throw new Error('REDIRECT')
    return currentUser
  },
  requireUser: async () => currentUser,
}))
vi.mock('@/lib/db', () => ({ get db() { return t.prisma } }))

describe('actions de validation', () => {
  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    currentUser = chef
  })
  afterEach(async () => { await t.cleanup() })

  it('valide une soumission et rend un message lisible', async () => {
    const { createProject } = await import('@/lib/services/projectService')
    const { createTask, joinTask } = await import('@/lib/services/taskService')
    const { submitTask } = await import('@/lib/services/submissionService')
    const { reviewAction } = await import('@/app/(chef)/validation/actions')

    const project = await createProject(t.prisma, chef, { title: 'Camp' })
    const task = await createTask(t.prisma, chef, { projectId: project.id, title: 'Budget', phase: 'AGIR', difficulty: 'MOYEN' })
    await joinTask(t.prisma, lucie, task.id)
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    const form = new FormData()
    form.set('submissionId', submissionId)
    form.set('decision', 'ACCEPTEE')
    form.set('bonus', '0')

    const state = await reviewAction({}, form)
    expect(state.success).toMatch(/25 points/)
  })

  it('rend un message d erreur quand le refus n a pas de commentaire', async () => {
    const { createProject } = await import('@/lib/services/projectService')
    const { createTask, joinTask } = await import('@/lib/services/taskService')
    const { submitTask } = await import('@/lib/services/submissionService')
    const { reviewAction } = await import('@/app/(chef)/validation/actions')

    const project = await createProject(t.prisma, chef, { title: 'Camp' })
    const task = await createTask(t.prisma, chef, { projectId: project.id, title: 'Budget', phase: 'AGIR', difficulty: 'MOYEN' })
    await joinTask(t.prisma, lucie, task.id)
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    const form = new FormData()
    form.set('submissionId', submissionId)
    form.set('decision', 'REFUSEE')
    form.set('comment', '')

    expect((await reviewAction({}, form)).error).toMatch(/commentaire/i)
  })
})
```

- [ ] **Step 3: Lancer le test**

Run: `pnpm test tests/integration/validationActions.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 4: Écrire `src/components/ReviewCard.tsx`**

```tsx
'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { reviewAction } from '@/app/(chef)/validation/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

interface Props {
  submission: {
    id: string
    message: string
    submittedBy: { displayName: string }
    attachments: { id: string; originalName: string; width: number; height: number }[]
    task: { title: string; difficulty: string; assignments: { user: { displayName: string } }[] }
  }
  maxBonus: number
  pointsParJeune: number
}

export function ReviewCard({ submission, maxBonus, pointsParJeune }: Props) {
  const [state, action, pending] = useActionState(reviewAction, EMPTY_FORM_STATE)

  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-stone-900">
      <h3 className="font-bold">{submission.task.title}</h3>
      <p className="text-sm opacity-70">
        Rendu par {submission.submittedBy.displayName} ·{' '}
        {submission.task.assignments.map((a) => a.user.displayName).join(', ')} ·{' '}
        {pointsParJeune} pts par jeune
      </p>

      {submission.message ? <p className="mt-2 whitespace-pre-wrap text-sm">{submission.message}</p> : null}

      {submission.attachments.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {submission.attachments.map((photo) => (
            <li key={photo.id}>
              <Image src={`/api/fichiers/${photo.id}`} alt={photo.originalName}
                width={photo.width} height={photo.height} className="h-24 w-full rounded-lg object-cover" />
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="submissionId" value={submission.id} />

        <label className="text-sm">
          Bonus (0 à {maxBonus} points)
          <input name="bonus" type="number" min={0} max={maxBonus} defaultValue={0}
            className="mt-1 w-24 rounded-lg border p-2" />
        </label>

        <textarea name="comment" rows={2} className="rounded-lg border p-2"
          placeholder="Commentaire (obligatoire en cas de refus)" />

        {state.error ? <p role="alert" className="rounded-lg bg-red-100 p-2 text-sm text-red-900">{state.error}</p> : null}
        {state.success ? <p className="rounded-lg bg-emerald-100 p-2 text-sm text-emerald-900">{state.success}</p> : null}

        <div className="flex gap-2">
          <button name="decision" value="ACCEPTEE" disabled={pending}
            className="flex-1 rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-60">
            ✅ Valider
          </button>
          <button name="decision" value="REFUSEE" disabled={pending}
            className="flex-1 rounded-lg bg-amber-500 p-3 font-semibold text-white disabled:opacity-60">
            ✏️ À corriger
          </button>
        </div>
      </form>
    </article>
  )
}
```

- [ ] **Step 5: Écrire `src/app/(chef)/validation/page.tsx`**

Trois sections : soumissions à traiter, tâches proposées, candidatures aux rôles (celles-ci arrivent en Tâche 19, afficher un lien vers `/roles` en attendant).

```tsx
import { ReviewCard } from '@/components/ReviewCard'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { computeTaskAward, maxBonus } from '@/lib/domain/points'
import type { Difficulty } from '@/lib/domain/types'
import { getScale } from '@/lib/services/settingsService'
import { listPendingSubmissions } from '@/lib/services/submissionService'
import { proposalAction } from './actions'

export default async function ValidationPage() {
  await requireChef()
  const [submissions, propositions, scale] = await Promise.all([
    listPendingSubmissions(db),
    db.task.findMany({ where: { status: 'PROPOSEE' }, include: { createdBy: { select: { displayName: true } } } }),
    getScale(db),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">À valider</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Travaux rendus ({submissions.length})</h2>
        {submissions.length === 0 ? <p className="text-sm opacity-70">Rien en attente. 🎉</p> : null}
        {submissions.map((submission) => {
          const difficulty = submission.task.difficulty as Difficulty
          const n = Math.max(1, submission.task.assignments.length)
          return (
            <ReviewCard
              key={submission.id}
              submission={submission}
              maxBonus={maxBonus(difficulty, scale)}
              pointsParJeune={computeTaskAward(difficulty, n, 0, scale)}
            />
          )
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Tâches proposées ({propositions.length})</h2>
        {propositions.length === 0 ? <p className="text-sm opacity-70">Aucune proposition en attente.</p> : null}
        {propositions.map((task) => (
          <article key={task.id} className="rounded-2xl border p-4">
            <p className="font-semibold">{task.title}</p>
            <p className="text-sm opacity-70">Proposée par {task.createdBy.displayName}</p>
            {task.description ? <p className="mt-2 text-sm">{task.description}</p> : null}
            <div className="mt-3 flex gap-2">
              <form action={proposalAction.bind(null, task.id, true)}>
                <button className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Accepter</button>
              </form>
              <form action={proposalAction.bind(null, task.id, false)}>
                <button className="rounded-lg border px-4 py-2">Écarter</button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 6: Écrire la création de tâches et le catalogue**

```ts
// src/app/(chef)/taches/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef, requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { Difficulty, Phase } from '@/lib/domain/types'
import { getActiveProject } from '@/lib/services/projectService'
import { createTask } from '@/lib/services/taskService'
import { NotFoundError, ValidationError } from '@/lib/services/errors'

/** Un chef crée une tâche ouverte ; un jeune crée une proposition. Même action. */
export async function createTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  try {
    const project = await getActiveProject(db)
    if (!project) throw new NotFoundError('CAP en cours')

    await createTask(db, user, {
      projectId: project.id,
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      phase: String(formData.get('phase') ?? 'AGIR') as Phase,
      difficulty: String(formData.get('difficulty') ?? 'MOYEN') as Difficulty,
    })
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/cap')
  revalidatePath('/taches')
  return { success: 'Tâche enregistrée.' }
}

export async function createFromTemplateAction(templateId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    const [template, project] = await Promise.all([
      db.taskTemplate.findUnique({ where: { id: templateId } }),
      getActiveProject(db),
    ])
    if (!template) throw new NotFoundError('Modèle')
    if (!project) throw new NotFoundError('CAP en cours')

    await createTask(db, chef, {
      projectId: project.id,
      title: template.title,
      description: template.description,
      phase: template.phase as Phase,
      difficulty: template.difficulty as Difficulty,
    })
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/cap')
  return { success: 'Tâche ajoutée au CAP.' }
}

export async function saveAsTemplateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireChef()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return toFormError(new ValidationError('Le titre est obligatoire.'))

  await db.taskTemplate.create({
    data: {
      title,
      description: String(formData.get('description') ?? ''),
      phase: String(formData.get('phase') ?? 'AGIR'),
      difficulty: String(formData.get('difficulty') ?? 'MOYEN'),
      isBuiltin: false,
    },
  })

  revalidatePath('/taches')
  return { success: 'Modèle enregistré, tu le retrouveras au prochain CAP.' }
}
```

La page `/taches` liste le catalogue groupé par phase avec un bouton « Ajouter au CAP » par modèle, et le formulaire `NewTaskForm` (titre, description, phase, difficulté, case « enregistrer aussi comme modèle »). Les jeunes accèdent au même formulaire depuis `/cap` via un bouton « Proposer une tâche » : `createTaskAction` crée alors une `PROPOSEE`.

- [ ] **Step 7: Vérifier à la main**

Depuis un compte chef : créer une tâche, l'ajouter depuis le catalogue, valider une soumission avec bonus, en refuser une sans commentaire (message d'erreur attendu).

- [ ] **Step 8: Commit**

```bash
git add src/app src/components tests/integration/validationActions.test.ts
git commit -m "feat: file de validation des chefs et création de tâches"
```

---

### Task 19: Rôles, notifications, classement et profil

**Files:**
- Create: `src/app/(app)/roles/page.tsx`, `src/app/(app)/roles/actions.ts`, `src/app/(app)/notifications/page.tsx`, `src/app/(app)/notifications/actions.ts`, `src/app/(app)/classement/page.tsx`, `src/app/(app)/profil/page.tsx`, `src/components/BadgeShelf.tsx`
- Test: `tests/integration/rolesActions.test.ts`

**Interfaces:**
- Consumes: `listRoles`, `applyToRole`, `decideApplication`, `closeRole`, `createRole` (T13) ; `getLeaderboard`, `getLedger`, `getScore` (T8) ; `listNotifications`, `markAllRead` (T8).
- Produces: `applyAction`, `decideApplicationAction`, `closeRoleAction`, `createRoleAction`, `markAllReadAction`.

- [ ] **Step 1: Écrire les actions des rôles**

```ts
// src/app/(app)/roles/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef, requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { NotFoundError } from '@/lib/services/errors'
import { getActiveProject } from '@/lib/services/projectService'
import { applyToRole, closeRole, createRole, decideApplication } from '@/lib/services/roleService'

export async function applyAction(projectRoleId: string): Promise<FormState> {
  const user = await requireUser()
  try {
    await applyToRole(db, user, projectRoleId)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/roles')
  return { success: 'Candidature envoyée aux chefs.' }
}

export async function decideApplicationAction(
  projectRoleId: string,
  userId: string,
  accept: boolean,
): Promise<FormState> {
  const chef = await requireChef()
  try {
    await decideApplication(db, chef, { projectRoleId, userId, accept })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/roles')
  return { success: accept ? 'Rôle attribué.' : 'Candidature écartée.' }
}

export async function closeRoleAction(projectRoleId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    const result = await closeRole(db, chef, projectRoleId)
    revalidatePath('/roles')
    return { success: `Rôle clôturé : ${result.awarded} points versés.` }
  } catch (error) {
    return toFormError(error)
  }
}

export async function createRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  try {
    const project = await getActiveProject(db)
    if (!project) throw new NotFoundError('CAP en cours')

    await createRole(db, chef, {
      projectId: project.id,
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      points: Number(formData.get('points') ?? 0),
    })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/roles')
  return { success: 'Rôle créé.' }
}
```

- [ ] **Step 2: Écrire le test des actions des rôles**

```ts
// tests/integration/rolesActions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createTestDb, type TestDb } from '../helpers/db'

let t: TestDb
let chef: Actor
let lucie: Actor
let currentUser: Actor

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/guard', () => ({
  requireUser: async () => currentUser,
  requireChef: async () => {
    if (currentUser.role === 'JEUNE') throw new Error('REDIRECT')
    return currentUser
  },
}))
vi.mock('@/lib/db', () => ({ get db() { return t.prisma } }))

describe('actions des rôles', () => {
  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    await t.prisma.project.create({ data: { title: 'Camp' } })
  })
  afterEach(async () => { await t.cleanup() })

  it('candidature puis attribution, bout en bout', async () => {
    const { applyAction, createRoleAction, decideApplicationAction } = await import('@/app/(app)/roles/actions')

    currentUser = chef
    const form = new FormData()
    form.set('name', 'Trésorier')
    form.set('points', '60')
    expect((await createRoleAction({}, form)).success).toBeTruthy()

    const role = await t.prisma.projectRole.findFirstOrThrow()

    currentUser = lucie
    expect((await applyAction(role.id)).success).toMatch(/Candidature/)

    currentUser = chef
    expect((await decideApplicationAction(role.id, lucie.id, true)).success).toMatch(/attribué/)
    expect((await t.prisma.projectRole.findUniqueOrThrow({ where: { id: role.id } })).holderId).toBe(lucie.id)
  })

  it('rend un message d erreur sur une double candidature', async () => {
    const { applyAction, createRoleAction } = await import('@/app/(app)/roles/actions')

    currentUser = chef
    const form = new FormData()
    form.set('name', 'Intendant')
    form.set('points', '40')
    await createRoleAction({}, form)
    const role = await t.prisma.projectRole.findFirstOrThrow()

    currentUser = lucie
    await applyAction(role.id)
    expect((await applyAction(role.id)).error).toMatch(/déjà/)
  })
})
```

- [ ] **Step 3: Lancer le test**

Run: `pnpm test tests/integration/rolesActions.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 4: Écrire `src/app/(app)/roles/page.tsx`**

La page liste les rôles du CAP en cours. Pour chacun : nom, description, points, titulaire ou « vacant ». Un jeune voit un bouton « Je me porte candidat » si le rôle est vacant et qu'il n'a pas déjà postulé. Un chef voit en plus, sous chaque rôle vacant, la liste des candidats avec deux boutons (« Attribuer », « Écarter »), et pour un rôle tenu un bouton « Clôturer le rôle » qui verse les points. Un chef dispose aussi du formulaire de création de rôle (nom, description, points), avec quatre suggestions en un clic : Trésorier, Intendant, Responsable communication, Responsable matériel.

```tsx
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { isChef } from '@/lib/domain/types'
import { getActiveProject } from '@/lib/services/projectService'
import { listRoles } from '@/lib/services/roleService'
import { applyAction, closeRoleAction, decideApplicationAction } from './actions'

export default async function RolesPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)
  if (!project) return <p>Aucun CAP en cours.</p>

  const roles = await listRoles(db, project.id)
  const chef = isChef(user)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Les rôles du CAP</h1>

      {roles.length === 0 ? <p className="text-sm opacity-70">Aucun rôle défini pour l'instant.</p> : null}

      {roles.map((role) => (
        <article key={role.id} className="rounded-2xl border bg-white p-4 dark:bg-stone-900">
          <header className="flex items-baseline justify-between">
            <h2 className="font-bold">{role.name}</h2>
            <span className="text-sm opacity-70">{role.points} pts</span>
          </header>
          {role.description ? <p className="mt-1 text-sm">{role.description}</p> : null}

          <p className="mt-2 text-sm">
            {role.holder
              ? `Tenu par ${role.holder.displayName}${role.closedAt ? ' · clôturé' : ''}`
              : 'Personne ne tient ce rôle pour l\'instant.'}
          </p>

          {!role.holder && !chef ? (
            <form action={applyAction.bind(null, role.id)} className="mt-3">
              <button className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">
                Je me porte candidat
              </button>
            </form>
          ) : null}

          {chef && role.applications.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {role.applications.map((application) => (
                <li key={application.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-100 p-2 dark:bg-stone-800">
                  <span className="text-sm">{application.user.displayName}</span>
                  <span className="flex gap-2">
                    <form action={decideApplicationAction.bind(null, role.id, application.user.id, true)}>
                      <button className="rounded bg-emerald-600 px-3 py-1 text-sm text-white">Attribuer</button>
                    </form>
                    <form action={decideApplicationAction.bind(null, role.id, application.user.id, false)}>
                      <button className="rounded border px-3 py-1 text-sm">Écarter</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {chef && role.holder && !role.closedAt ? (
            <form action={closeRoleAction.bind(null, role.id)} className="mt-3">
              <button className="rounded-lg border px-4 py-2 text-sm">Clôturer et verser les points</button>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Écrire le classement, les notifications et le profil**

`/classement` : appelle `getLeaderboard(db, project.id)` et affiche un podium (1ᵉʳ, 2ᵉ, 3ᵉ mis en avant) puis la liste, avec points et nombre de badges. Le jeune connecté est surligné.

`/notifications` : `listNotifications` et un bouton « Tout marquer comme lu » appelant `markAllReadAction` (action serveur : `requireUser`, `markAllRead`, `revalidatePath('/notifications')` et `revalidatePath('/accueil')`).

`/profil` : nom affiché, score total, `BadgeShelf` (tous les badges de la base, débloqués en couleur avec la date, verrouillés en grisé avec leur condition — un badge verrouillé affiche toujours ce qu'il faut faire), détail du score via `getLedger`, et lien vers `/profil/mot-de-passe`.

```tsx
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
```

- [ ] **Step 6: Vérifier à la main**

Vérifier qu'un jeune ne voit pas les boutons d'attribution, qu'un chef voit les candidatures, et que la cloche de l'accueil retombe à zéro après « tout marquer comme lu ».

- [ ] **Step 7: Commit**

```bash
git add src/app src/components tests/integration/rolesActions.test.ts
git commit -m "feat: rôles, notifications, classement et profil"
```

---

### Task 20: Espace chef et super admin

**Files:**
- Create: `src/app/(chef)/pilotage/page.tsx`, `src/app/(chef)/pilotage/actions.ts`, `src/app/(chef)/membres/page.tsx`, `src/app/(chef)/membres/actions.ts`, `src/app/(admin)/comptes/page.tsx`, `src/app/(admin)/comptes/actions.ts`, `src/app/(admin)/parametres/page.tsx`, `src/app/(admin)/parametres/actions.ts`
- Test: `tests/integration/adminActions.test.ts`

**Interfaces:**
- Consumes: `createUser`, `resetPassword`, `setActive`, `listMembers` (T14) ; `createProject`, `setPhase`, `archiveProject`, `listProjects` (T11) ; `getScale`, `setScale` (T11).
- Produces: `createUserAction`, `resetPasswordAction`, `setActiveAction`, `setPhaseAction`, `archiveAction`, `newProjectAction`, `setScaleAction`.

- [ ] **Step 1: Écrire les actions d'administration**

```ts
// src/app/(admin)/comptes/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { AppRole } from '@/lib/domain/types'
import { createUser, setActive } from '@/lib/services/userService'

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireSuperAdmin()
  try {
    const { user, tempPassword } = await createUser(db, admin, {
      username: String(formData.get('username') ?? ''),
      displayName: String(formData.get('displayName') ?? ''),
      role: String(formData.get('role') ?? 'JEUNE') as AppRole,
    })
    revalidatePath('/comptes')
    // Le mot de passe provisoire n'est affiché qu'ici, une seule fois.
    return { success: `Compte « ${user.username} » créé. Mot de passe provisoire : ${tempPassword}` }
  } catch (error) {
    return toFormError(error)
  }
}

export async function setActiveAction(userId: string, active: boolean): Promise<FormState> {
  const admin = await requireSuperAdmin()
  try {
    await setActive(db, admin, userId, active)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/comptes')
  return { success: active ? 'Compte réactivé.' : 'Compte désactivé.' }
}
```

```ts
// src/app/(chef)/membres/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { resetPassword } from '@/lib/services/userService'

export async function resetPasswordAction(userId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    const tempPassword = await resetPassword(db, chef, userId)
    revalidatePath('/membres')
    return { success: `Nouveau mot de passe provisoire : ${tempPassword} — note-le, il ne sera plus affiché.` }
  } catch (error) {
    return toFormError(error)
  }
}
```

```ts
// src/app/(chef)/pilotage/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { Phase } from '@/lib/domain/types'
import { archiveProject, createProject, getActiveProject, setPhase } from '@/lib/services/projectService'
import { notifyMany } from '@/lib/services/notificationService'
import { NotFoundError } from '@/lib/services/errors'

export async function setPhaseAction(phase: Phase): Promise<FormState> {
  const chef = await requireChef()
  try {
    const project = await getActiveProject(db)
    if (!project) throw new NotFoundError('CAP en cours')
    await setPhase(db, chef, project.id, phase)

    const jeunes = await db.user.findMany({ where: { role: 'JEUNE', isActive: true }, select: { id: true } })
    await notifyMany(db, jeunes.map((j) => j.id), {
      type: 'PHASE',
      message: `Le CAP passe en phase ${phase.toLowerCase()} !`,
      link: '/cap',
    })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap')
  revalidatePath('/pilotage')
  return { success: 'Phase mise à jour.' }
}

export async function archiveAction(): Promise<FormState> {
  const chef = await requireChef()
  try {
    const project = await getActiveProject(db)
    if (!project) throw new NotFoundError('CAP en cours')
    await archiveProject(db, chef, project.id)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap')
  revalidatePath('/pilotage')
  return { success: 'CAP archivé. Il reste consultable, mais plus modifiable.' }
}

export async function newProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  try {
    const current = await getActiveProject(db)
    if (current) await archiveProject(db, chef, current.id)

    await createProject(db, chef, {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
    })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap')
  revalidatePath('/pilotage')
  return { success: 'Nouveau CAP démarré !' }
}
```

```ts
// src/app/(admin)/parametres/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { ValidationError } from '@/lib/services/errors'
import { setScale } from '@/lib/services/settingsService'

export async function setScaleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSuperAdmin()
  const read = (key: string) => Math.round(Number(formData.get(key) ?? 0))
  const scale = { FACILE: read('FACILE'), MOYEN: read('MOYEN'), DIFFICILE: read('DIFFICILE') }

  try {
    if (Object.values(scale).some((v) => !Number.isInteger(v) || v <= 0)) {
      throw new ValidationError('Chaque valeur du barème doit être un entier supérieur à zéro.')
    }
    await setScale(db, scale)
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/parametres')
  return { success: 'Barème enregistré. Les tâches déjà validées gardent leurs points.' }
}
```

- [ ] **Step 2: Écrire le test des actions d'administration**

```ts
// tests/integration/adminActions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createTestDb, type TestDb } from '../helpers/db'

let t: TestDb
let admin: Actor
let chef: Actor
let currentUser: Actor

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/guard', () => ({
  requireSuperAdmin: async () => {
    if (currentUser.role !== 'SUPER_ADMIN') throw new Error('REDIRECT')
    return currentUser
  },
  requireChef: async () => {
    if (currentUser.role === 'JEUNE') throw new Error('REDIRECT')
    return currentUser
  },
  requireUser: async () => currentUser,
}))
vi.mock('@/lib/db', () => ({ get db() { return t.prisma } }))

describe('actions d administration', () => {
  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    admin = await mk('admin', 'SUPER_ADMIN')
    chef = await mk('sarah', 'CHEF')
    currentUser = admin
  })
  afterEach(async () => { await t.cleanup() })

  it('crée un compte et affiche le mot de passe provisoire une fois', async () => {
    const { createUserAction } = await import('@/app/(admin)/comptes/actions')
    const form = new FormData()
    form.set('username', 'lucie')
    form.set('displayName', 'Lucie M.')
    form.set('role', 'JEUNE')

    const state = await createUserAction({}, form)
    expect(state.success).toMatch(/Mot de passe provisoire : [a-z2-9]{12}/)
  })

  it('refuse la création de compte à un chef', async () => {
    const { createUserAction } = await import('@/app/(admin)/comptes/actions')
    currentUser = chef
    const form = new FormData()
    form.set('username', 'tom')
    form.set('displayName', 'Tom')
    await expect(createUserAction({}, form)).rejects.toThrow('REDIRECT')
  })

  it('refuse un barème à zéro ou négatif', async () => {
    const { setScaleAction } = await import('@/app/(admin)/parametres/actions')
    const form = new FormData()
    form.set('FACILE', '0')
    form.set('MOYEN', '25')
    form.set('DIFFICILE', '50')
    expect((await setScaleAction({}, form)).error).toMatch(/supérieur à zéro/)
  })

  it('démarre un nouveau CAP en archivant le précédent', async () => {
    const { newProjectAction } = await import('@/app/(chef)/pilotage/actions')
    currentUser = chef
    await t.prisma.project.create({ data: { title: 'CAP 2026' } })

    const form = new FormData()
    form.set('title', 'CAP 2027')
    expect((await newProjectAction({}, form)).success).toMatch(/démarré/)

    const projets = await t.prisma.project.findMany({ orderBy: { startedAt: 'asc' } })
    expect(projets.map((p) => p.status)).toEqual(['ARCHIVE', 'EN_COURS'])
  })
})
```

- [ ] **Step 3: Lancer le test**

Run: `pnpm test tests/integration/adminActions.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4: Écrire les pages**

`/comptes` (super admin) : tableau des membres (`listMembers`) avec identifiant, nom affiché, rôle, état, et pour chacun un bouton activer/désactiver ; formulaire de création (identifiant, nom affiché, rôle) dont le message de succès affiche le mot de passe provisoire dans un encadré bien visible, avec la mention « note-le maintenant, il ne sera plus affiché ».

`/membres` (chef) : liste des jeunes avec un bouton « Nouveau mot de passe », même encadré.

`/pilotage` (chef) : le CAP en cours, trois boutons de phase (la phase courante mise en évidence), un bouton « Archiver ce CAP », un formulaire « Démarrer un nouveau CAP », et la liste des CAP archivés.

`/parametres` (super admin) : formulaire du barème (trois nombres) et tableau des badges en lecture avec leurs seuils.

- [ ] **Step 5: Vérifier à la main**

Créer un compte jeune depuis `/comptes`, se connecter avec, vérifier le changement de mot de passe forcé, puis le désactiver et vérifier que sa session est immédiatement coupée.

- [ ] **Step 6: Commit**

```bash
git add src/app tests/integration/adminActions.test.ts
git commit -m "feat: espace chef et super admin, pilotage du CAP"
```

---

### Task 21: Docker, déploiement et sauvegarde

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-entrypoint.sh`, `scripts/backup.sh`, `README.md`
- Modify: `next.config.ts` (déjà en `output: 'standalone'` depuis la Tâche 17)

**Interfaces:**
- Consumes: l'application complète.
- Produces: `docker compose up -d --build` démarre le site sur le port 3000, base et photos dans le volume `/data`.

- [ ] **Step 1: Écrire le `Dockerfile`**

```dockerfile
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/cap.db"
ENV UPLOAD_DIR="/data/uploads"

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/tsx ./node_modules/tsx
COPY docker-entrypoint.sh ./

RUN mkdir -p /data/uploads && chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

- [ ] **Step 2: Écrire `docker-entrypoint.sh`**

```bash
#!/bin/sh
set -e

echo "Application des migrations…"
node_modules/.bin/prisma migrate deploy

echo "Amorçage (idempotent)…"
node_modules/.bin/prisma db seed || echo "Amorçage ignoré."

echo "Démarrage du site sur le port 3000."
exec node server.js
```

- [ ] **Step 3: Écrire `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "file:/data/cap.db"
      UPLOAD_DIR: "/data/uploads"
      SUPER_ADMIN_USERNAME: "${SUPER_ADMIN_USERNAME:-admin}"
      SUPER_ADMIN_PASSWORD: "${SUPER_ADMIN_PASSWORD:?définis SUPER_ADMIN_PASSWORD dans .env}"
    volumes:
      - cap-data:/data

volumes:
  cap-data:
```

Derrière un reverse proxy en HTTPS (Caddy, Traefik, nginx) : le cookie de session est `Secure` en production, donc le site **doit** être servi en HTTPS, sinon personne ne peut se connecter. À écrire noir sur blanc dans le README.

- [ ] **Step 4: Écrire `scripts/backup.sh`**

```bash
#!/bin/sh
# Sauvegarde cohérente de la base et des photos. À lancer par cron, par exemple
# chaque nuit : 0 3 * * * /chemin/vers/scripts/backup.sh
set -e

DEST="${1:-./sauvegardes}"
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DEST"

docker compose exec -T app node_modules/.bin/prisma db execute \
  --stdin <<SQL
VACUUM INTO '/data/backup-tmp.db';
SQL

docker compose cp app:/data/backup-tmp.db "$DEST/cap-$STAMP.db"
docker compose exec -T app rm -f /data/backup-tmp.db
docker compose exec -T app tar czf - -C /data uploads > "$DEST/uploads-$STAMP.tar.gz"

# Rotation : on garde les 30 dernières sauvegardes.
ls -1t "$DEST"/cap-*.db | tail -n +31 | xargs -r rm --
ls -1t "$DEST"/uploads-*.tar.gz | tail -n +31 | xargs -r rm --

echo "Sauvegarde faite dans $DEST (cap-$STAMP.db)"
```

`VACUUM INTO` produit une copie cohérente même pendant que le site tourne, contrairement à une simple copie du fichier.

- [ ] **Step 5: Construire et démarrer**

```bash
echo "SUPER_ADMIN_PASSWORD=choisis-un-mot-de-passe-solide" > .env
docker compose up -d --build
docker compose logs -f app
```

Expected: les migrations s'appliquent, l'amorçage crée le super admin, le site répond sur `http://localhost:3000`.

- [ ] **Step 6: Vérifier la persistance et la sauvegarde**

```bash
docker compose restart app
sh scripts/backup.sh /tmp/sauvegardes-cap
ls -l /tmp/sauvegardes-cap
```

Expected: les comptes et les photos survivent au redémarrage ; deux fichiers horodatés dans le dossier de sauvegarde.

- [ ] **Step 7: Écrire le `README.md`**

Installation, premier démarrage, création des comptes, obligation du HTTPS, sauvegarde et restauration, mise à jour (`git pull && docker compose up -d --build`).

- [ ] **Step 8: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml docker-entrypoint.sh scripts README.md
git commit -m "feat: déploiement Docker et script de sauvegarde"
```

---

### Task 22: Parcours bout en bout

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers/seed.ts`, `e2e/parcours-cap.spec.ts`
- Modify: `package.json` (script `test:e2e`), `e2e/connexion.spec.ts` (écrit en Tâche 15)

**Interfaces:**
- Consumes: l'application complète.
- Produces: `pnpm test:e2e` lance le serveur sur une base jetable et joue les parcours.

- [ ] **Step 1: Installer Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Écrire `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3100', locale: 'fr-FR' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'pnpm exec tsx e2e/helpers/seed.ts && pnpm build && pnpm start -p 3100',
    url: 'http://localhost:3100/login',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: 'file:./e2e/e2e.db',
      UPLOAD_DIR: './e2e/uploads',
      NODE_ENV: 'production',
    },
  },
})
```

- [ ] **Step 3: Écrire `e2e/helpers/seed.ts`**

Script qui supprime `e2e/e2e.db`, applique le schéma (`prisma db push`), lance le seed habituel, puis crée les comptes du scénario : `sarah` (CHEF, mot de passe `chef-mdp-2027`, `mustChangePassword: false`), `lucie` et `tom` (JEUNE, mot de passe `motdepasse-initial`, `mustChangePassword: true` pour Lucie et `false` pour Tom), plus un CAP « Camp d'été 2027 » et deux tâches ouvertes.

- [ ] **Step 4: Écrire le parcours complet**

```ts
// e2e/parcours-cap.spec.ts
import { expect, test } from '@playwright/test'

async function seConnecter(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Identifiant').fill(username)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

test('inscription, soumission, refus, correction, validation et points', async ({ page }) => {
  // Le jeune prend une tâche et la rend.
  await seConnecter(page, 'tom', 'motdepasse-initial')
  await page.getByRole('link', { name: 'Le CAP' }).click()
  await page.getByText('Établir le budget prévisionnel').click()
  await page.getByRole('button', { name: "Je m'inscris" }).click()
  await expect(page.getByText('Tom')).toBeVisible()

  await page.getByPlaceholder('Raconte ce que tu as fait').fill('Budget prêt, voir le tableau.')
  await page.getByRole('button', { name: 'Soumettre aux chefs' }).click()
  await expect(page.getByText("En attente de la réponse d'un chef")).toBeVisible()

  // Le chef refuse avec un commentaire.
  await seConnecter(page, 'sarah', 'chef-mdp-2027')
  await page.getByRole('link', { name: 'Valider' }).click()
  await page.getByPlaceholder('Commentaire').fill('Il manque les recettes.')
  await page.getByRole('button', { name: 'À corriger' }).click()
  await expect(page.getByText('Renvoyée au jeune')).toBeVisible()

  // Le jeune corrige et resoumet.
  await seConnecter(page, 'tom', 'motdepasse-initial')
  await page.getByRole('link', { name: 'Le CAP' }).click()
  await page.getByText('Établir le budget prévisionnel').click()
  await expect(page.getByText('Il manque les recettes.')).toBeVisible()
  await page.getByPlaceholder('Raconte ce que tu as fait').fill('Recettes ajoutées.')
  await page.getByRole('button', { name: 'Soumettre aux chefs' }).click()

  // Le chef valide avec un bonus.
  await seConnecter(page, 'sarah', 'chef-mdp-2027')
  await page.getByRole('link', { name: 'Valider' }).click()
  await page.getByLabel(/Bonus/).fill('10')
  await page.getByRole('button', { name: 'Valider' }).last().click()
  await expect(page.getByText(/crédité/)).toBeVisible()

  // Le jeune voit ses points et son badge.
  await seConnecter(page, 'tom', 'motdepasse-initial')
  await expect(page.getByText('60 pts')).toBeVisible() // 50 (difficile, seul) + 10 de bonus
  await expect(page.getByText('Premier pas')).toBeVisible()
})

test('un jeune ne voit pas la file de validation', async ({ page }) => {
  await seConnecter(page, 'tom', 'motdepasse-initial')
  await expect(page.getByRole('link', { name: 'Valider' })).toHaveCount(0)

  await page.goto('/validation')
  await expect(page).toHaveURL(/\/accueil/)
})
```

Le score attendu dépend du badge `premier_pas` (5 pts) : ajuster l'assertion au total réel au premier passage, et la figer ensuite.

- [ ] **Step 5: Lancer les tests bout en bout**

Run: `pnpm test:e2e`
Expected: PASS, 4 tests (2 de la Tâche 15, 2 ici).

- [ ] **Step 6: Lancer toute la suite une dernière fois**

```bash
pnpm test && pnpm test:e2e && pnpm build
```

Expected: tout passe, le build de production réussit.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e package.json
git commit -m "test: parcours bout en bout du CAP"
```

---

## Après l'implémentation

1. Lancer `pnpm test && pnpm test:e2e && pnpm build` une dernière fois.
2. Déployer sur le serveur : `docker compose up -d --build`, derrière un reverse proxy HTTPS.
3. Se connecter en super admin, changer le mot de passe initial, créer les comptes des chefs et des jeunes, noter les mots de passe provisoires.
4. Créer le premier CAP depuis `/pilotage`, ajouter quelques tâches depuis le catalogue, créer les rôles.
5. Programmer la sauvegarde : `0 3 * * * /chemin/vers/scripts/backup.sh /chemin/vers/sauvegardes`.
