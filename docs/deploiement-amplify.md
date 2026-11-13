# Déployer sur AWS Amplify Hosting

Le site tourne en serverless sur Amplify, avec trois ressources facturées à
l'usage, donc quelques centimes par mois pour une caravane, et rien quand
personne ne s'en sert :

| Ressource | Rôle |
|---|---|
| Table **DynamoDB** (à la requête) | toutes les données du site |
| Bucket **S3** privé | les photos des travaux rendus |
| Rôle **IAM** de calcul | donne au serveur Amplify l'accès à ces deux-là, sans clé d'accès |

Il n'y a ni base à administrer, ni migration : un champ ajouté au schéma Prisma
avec une valeur par défaut s'applique tout seul.

## Déploiement en place

- Région : `eu-west-3` (Paris)
- Dépôt connecté : `HBwilliam/GestionDeProjetPioka`, branche `amplify`
  (chaque push redéploie)
- App Amplify `notre-cap` (`d36e94q7y1sv9p`) :
  <https://amplify.d36e94q7y1sv9p.amplifyapp.com>
- Table `notre-cap`, bucket `notre-cap-photos-694294576234`,
  rôle `notre-cap-amplify-compute`

## Refaire l'installation de zéro

Toutes les commandes utilisent la CLI AWS connectée (`aws login`).

1. **Table DynamoDB** (clés `pk`/`sk`, facturation à la requête) :

   ```bash
   eval "$(aws configure export-credentials --format env)"
   DYNAMODB_TABLE=notre-cap DYNAMODB_REGION=eu-west-3 npx tsx scripts/creer-table.ts
   aws dynamodb update-continuous-backups --region eu-west-3 --table-name notre-cap \
     --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
   aws dynamodb update-table --region eu-west-3 --table-name notre-cap --deletion-protection-enabled
   ```

2. **Bucket S3** : accès public entièrement bloqué, versioning activé, les
   anciennes versions purgées après 30 jours. Chiffrement SSE-S3 par défaut.

3. **Rôle IAM** approuvé par `amplify.amazonaws.com`, avec une seule politique :
   - `dynamodb:Query`, `GetItem`, `PutItem`, `DeleteItem`, `UpdateItem`,
     `ConditionCheckItem`, `DescribeTable` sur la table ;
   - `s3:PutObject`, `GetObject`, `DeleteObject` sur `arn:aws:s3:::<bucket>/photos/*`.

4. **App Amplify** connectée au dépôt, plateforme *Web compute* (SSR), le rôle
   ci-dessus comme **rôle de calcul**, et ces variables d'environnement :

   | Variable | Valeur |
   |---|---|
   | `DYNAMODB_TABLE` | `notre-cap` |
   | `DYNAMODB_REGION` | `eu-west-3` |
   | `S3_BUCKET` | le nom du bucket |
   | `S3_REGION` | `eu-west-3` |

   Le build suit `amplify.yml` : `npm ci`, `prisma generate` (types), `next build`.

5. **Amorçage**, une fois, depuis un poste : badges, catalogue de tâches,
   premier CAP et super admin (mot de passe à changer à la première connexion).

   ```bash
   DYNAMODB_TABLE=notre-cap DYNAMODB_REGION=eu-west-3 DATA_FILE= \
     SUPER_ADMIN_PASSWORD='mot-de-passe-provisoire' npm run seed
   ```

   L'amorçage est idempotent : on peut le relancer sans rien écraser.

## Sauvegardes

- DynamoDB : restauration à la seconde près sur les 35 derniers jours
  (point-in-time recovery), depuis la console DynamoDB > Sauvegardes.
- S3 : versioning, chaque photo remplacée ou supprimée reste récupérable 30 jours.

## Limites

Chaque lecture charge un modèle entier puis filtre en mémoire côté serveur.
C'est rapide et quasi gratuit pour une caravane (quelques centaines de lignes
par modèle). Ce n'est pas fait pour des dizaines de milliers de lignes.
