# Notre CAP — site de gestion de projet Pionniers-Caravelles

Un site pour qu'une caravane mène son CAP (Choisir · Agir · Partager) : les jeunes
s'inscrivent sur les tâches et les rôles, rendent leur travail, gagnent des points
et des badges ; les chefs valident ou renvoient à corriger.

- Conception : `docs/superpowers/specs/2026-10-15-cap-pionniers-design.md`
- Plan d'implémentation : `docs/superpowers/plans/2026-10-15-cap-pionniers.md`

## Hébergement

Deux façons d'héberger le site, sur la même base de code :

- **AWS Amplify Hosting** (serverless) : données dans DynamoDB, photos dans S3,
  facturé à l'usage (quelques centimes par mois pour une caravane).
  Pas à pas : [`docs/deploiement-amplify.md`](docs/deploiement-amplify.md).
- **Ton propre serveur** avec Docker, décrit ci-dessous.

## Installation sur ton serveur

Prérequis : Docker et le plugin Compose.

```bash
git clone <ton-dépôt> site-cap && cd site-cap
echo "SUPER_ADMIN_PASSWORD=choisis-un-mot-de-passe-solide" > .env
docker compose up -d --build
```

Le site écoute sur le port 3000. Les données (un fichier `cap.json`) et les
photos vivent sur le volume `cap-data`. Au premier démarrage, il crée les 10 badges, les 22 tâches types du catalogue, un premier CAP
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

Copie des données (`cap.json`) et archive des photos, horodatées, avec
rotation sur les 30 dernières. À mettre dans cron :

```
0 3 * * * /chemin/vers/site-cap/scripts/backup.sh /chemin/vers/sauvegardes
```

Pour restaurer les données :

```bash
docker compose cp sauvegardes/cap-AAAAMMJJ-HHMMSS.json app:/data/cap.json && docker compose restart app
```

## Mise à jour

```bash
git pull && docker compose up -d --build
```

Pas de migration : un champ ajouté au schéma avec une valeur par défaut
s'applique tout seul.

## Développement

Node.js 20.19+ et npm. Aucune base à installer : en local, les données vivent
dans `.data/cap.json`.

```bash
npm install
cp .env.example .env
npm run seed       # badges, catalogue, super admin, premier CAP
npm run dev        # http://localhost:3000
```

Les tests tournent en mémoire. Pour les rejouer contre DynamoDB Local :

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory
TEST_DYNAMODB_TABLE=cap-test DYNAMODB_ENDPOINT=http://localhost:8000 \
  AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local npm test
```

| Commande | Rôle |
|---|---|
| `npm test` | tests unitaires et d'intégration (Vitest) |
| `npm run test:e2e` | parcours bout en bout (Playwright) |
| `npm run build` | build de production (sortie standalone) |
| `npm run seed` | amorçage idempotent (là où pointe l'environnement) |

### Organisation du code

```
src/lib/domain/    règles pures : points, machine à états, badges, photos
src/lib/services/  accès aux données ; chaque fonction reçoit le client et l'acteur
src/lib/data/      client de données au contrat de Prisma : DynamoDB, fichier, mémoire
src/lib/auth/      mots de passe, sessions, gardes
src/app/           pages et actions serveur (les actions ne font qu'appeler un service)
prisma/            schéma (types uniquement) et amorçage
tests/ · e2e/      tests
```

La logique de décision vit dans `src/lib/domain`, en fonctions pures testables
sans base ni navigateur. Les actions serveur se contentent de lire la session,
appeler une garde, puis un service.
