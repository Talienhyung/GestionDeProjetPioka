# Déployer sur AWS Amplify Hosting

Amplify héberge le site Next.js sur des fonctions serverless : rien n'est gardé
sur le disque entre deux requêtes. La base vit donc dans un **PostgreSQL géré**
et les photos dans un **bucket S3 privé**.

Ordre conseillé : base, bucket, rôle IAM, puis application Amplify.

## 1. La base PostgreSQL

Deux choix raisonnables, en Europe :

- **Neon** (offre gratuite suffisante pour une caravane) : crée un projet en
  région `eu-central-1` (Francfort). Copie deux adresses depuis *Connection
  details* :
  - **pooled** (l'hôte contient `-pooler`) → `DATABASE_URL`, en ajoutant
    `&pgbouncer=true&connection_limit=1` à la fin ;
  - **direct** (sans `-pooler`) → `DIRECT_URL`.
- **Amazon RDS for PostgreSQL** (`db.t4g.micro`, Postgres 16, région
  `eu-west-3` Paris) : accès public activé et groupe de sécurité ouvert sur le
  port 5432, Amplify n'ayant pas d'IP fixe. Mets la même adresse dans
  `DATABASE_URL` et `DIRECT_URL`, avec `?sslmode=require`.

Les fonctions serverless ouvrent beaucoup de connexions courtes : avec RDS,
garde `connection_limit=1` dans `DATABASE_URL`, ou passe par RDS Proxy.

## 2. Le bucket des photos

Console S3, **Create bucket** :

- nom : par exemple `notre-cap-photos` ; région : `eu-west-3` ;
- **Block all public access** : coché (les photos de mineurs ne sont jamais
  publiques ; le site les sert lui-même, après contrôle de la session) ;
- **Bucket Versioning** : activé (c'est la sauvegarde des photos) ;
- chiffrement par défaut SSE-S3 : laissé tel quel.

## 3. Le rôle de calcul SSR (IAM)

Le site accède au bucket avec un rôle, sans clé d'accès.

IAM → **Roles** → **Create role** → *Custom trust policy* :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "amplify.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Puis une stratégie en ligne, limitée au bucket :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::notre-cap-photos/photos/*"
    }
  ]
}
```

Nomme le rôle par exemple `notre-cap-ssr`.

## 4. L'application Amplify

1. Amplify → **Create new app** → GitHub → dépôt `GestionDeProjetPioka`,
   branche **`amplify`**.
2. Amplify détecte Next.js (SSR) et reprend `amplify.yml` du dépôt : ne change
   pas les commandes de build.
3. **Environment variables** (avant le premier build) :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | adresse via pooler (étape 1) |
   | `DIRECT_URL` | adresse directe (étape 1) |
   | `S3_BUCKET` | `notre-cap-photos` |
   | `S3_REGION` | `eu-west-3` |
   | `SUPER_ADMIN_USERNAME` | `admin` (facultatif) |
   | `SUPER_ADMIN_PASSWORD` | un mot de passe solide, provisoire |

   Pas de variable `AWS_…` : Amplify réserve ce préfixe, et les accès S3
   passent par le rôle.
4. **App settings → IAM roles → Compute role** : choisis `notre-cap-ssr`.
5. Lance le déploiement. Le build applique les migrations, amorce la base
   (badges, catalogue, super admin s'il n'existe pas), puis construit le site.
6. **Custom domains** : ajoute ton domaine ; Amplify fournit le certificat
   HTTPS (obligatoire : le cookie de session est `Secure`).

À la première connexion, le site demande au super admin de changer son mot de
passe. Tu peux ensuite retirer `SUPER_ADMIN_PASSWORD` des variables : il ne
sert qu'à créer le compte la première fois.

## Mises à jour

Chaque push sur la branche `amplify` redéploie. Les migrations s'appliquent au
build ; si l'une échoue, le déploiement s'arrête et l'ancienne version reste
en ligne.

## Limites à connaître

- **Taille des envois** : les fonctions d'Amplify refusent les requêtes de plus
  de ~6 Mo. Le navigateur réduit donc les photos (2000 px, JPEG) avant
  l'envoi ; le serveur les réencode ensuite en WebP 1600 px.
- **Démarrage à froid** : après un moment sans visite, la première page peut
  mettre une à deux secondes.
- **Logs** : CloudWatch, depuis l'onglet *Monitoring* de l'app Amplify.
