# Notre CAP — site de gestion de projet Pionniers-Caravelles

Un site pour qu'une caravane mène son CAP (Choisir · Agir · Partager) : les jeunes
s'inscrivent sur les tâches et les rôles, rendent leur travail, gagnent des points
et des badges ; les chefs valident ou renvoient à corriger.

- Conception : `docs/superpowers/specs/2026-10-15-cap-pionniers-design.md`
- Plan d'implémentation : `docs/superpowers/plans/2026-10-15-cap-pionniers.md`

## Hébergement

Deux façons d'héberger le site, sur la même base de code :

- **AWS Amplify Hosting** (serverless) : base PostgreSQL gérée, photos dans S3.
  Pas à pas : [`docs/deploiement-amplify.md`](docs/deploiement-amplify.md).
- **Ton propre serveur** avec Docker, décrit ci-dessous.

## Installation sur ton serveur

Prérequis : Docker et le plugin Compose.

```bash
git clone <ton-dépôt> site-cap && cd site-cap
cat > .env <<EOF
SUPER_ADMIN_PASSWORD=choisis-un-mot-de-passe-solide
POSTGRES_PASSWORD=un-autre-mot-de-passe-solide
EOF
docker compose up -d --build
```

Le site écoute sur le port 3000, sa base PostgreSQL tourne dans un second conteneur. Au premier démarrage, le conteneur applique les
migrations, crée les 10 badges, les 22 tâches types du catalogue, un premier CAP
et le compte super admin (`admin` par défaut, `SUPER_ADMIN_USERNAME` pour en
changer).

### HTTPS obligatoire

Le cookie de session est marqué `Secure` en production : **sans HTTPS, personne ne
peut se connecter**. Place le site derrière un reverse proxy (Caddy, Traefik,
nginx) qui termine le TLS et transmet vers `http://localhost:3000`.

Exemple avec Caddy :

```
cap.mondomaine.fr {
    reverse_proxy localhost:3000
}
```

## Premiers pas

1. Connecte-toi en super admin, change le mot de passe initial quand le site le demande.
2. `Comptes` : crée les comptes des chefs et des jeunes. **Note les mots de passe
   provisoires, ils ne sont affichés qu'une fois.**
3. `Pilotage` : donne un titre au CAP et choisis la phase en cours.
4. `Créer des tâches` : pioche dans le catalogue ou écris les tiennes.
5. `Rôles` : crée les rôles du projet (trésorier, intendant…).

Un jeune qui oublie son mot de passe : un chef lui en génère un nouveau depuis
`Les jeunes`.

## Sauvegarde

```bash
sh scripts/backup.sh /chemin/vers/sauvegardes
```

Copie cohérente de la base (`pg_dump`) et archive des photos, horodatées, avec
rotation sur les 30 dernières. À mettre dans cron :

```
0 3 * * * /chemin/vers/site-cap/scripts/backup.sh /chemin/vers/sauvegardes
```

Pour restaurer la base :

```bash
docker compose exec -T db pg_restore -U cap -d cap --clean < sauvegardes/cap-AAAA-MM-JJ_HHMM.dump
```

## Mise à jour

```bash
git pull && docker compose up -d --build
```

Les migrations s'appliquent automatiquement au démarrage.

## Développement

Node.js 20.19+, npm et Docker (pour la base PostgreSQL locale).

```bash
npm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL sur le port 5432
npx prisma migrate dev
npx prisma db seed
npm run dev        # http://localhost:3000
```

Les tests utilisent le même serveur PostgreSQL : chaque test d'intégration crée
puis supprime sa propre base (`TEST_DATABASE_URL` pour viser un autre serveur).

| Commande | Rôle |
|---|---|
| `npm test` | tests unitaires et d'intégration (Vitest) |
| `npm run test:e2e` | parcours bout en bout (Playwright) |
| `npm run build` | build de production (sortie standalone) |
| `npx prisma studio` | inspecter la base |

### Organisation du code

```
src/lib/domain/    règles pures : points, machine à états, badges, photos
src/lib/services/  accès base ; chaque fonction reçoit le client Prisma et l'acteur
src/lib/auth/      mots de passe, sessions, gardes
src/app/           pages et actions serveur (les actions ne font qu'appeler un service)
prisma/            schéma, migrations, amorçage
tests/ · e2e/      tests
```

La logique de décision vit dans `src/lib/domain`, en fonctions pures testables
sans base ni navigateur. Les actions serveur se contentent de lire la session,
appeler une garde, puis un service.
