# Suites possibles

Points connus, volontairement laissés de côté pour l'instant. Aucun n'empêche
d'utiliser le site ; ils sont rangés du plus utile au moins pressant.

## Confort au quotidien

- **Confirmation chiffrée pour le chef.** Après une validation, la carte quitte
  la file et emporte son message (« 2 jeunes crédités de 13 points »). Le chef
  voit la file se vider mais perd le détail.
- **Filtres sur le tableau du CAP** (libres / les miennes / à corriger), prévus
  par la conception §12. Les données sont déjà là, c'est de l'affichage.
- **Gestion des badges et du catalogue depuis les paramètres.** Aujourd'hui seul
  le barème est modifiable ; badges et modèles se changent en base.
- **Ligne « bonus » distincte dans le grand livre.** Le bonus est fondu dans la
  ligne de la tâche, alors que le profil sait déjà l'afficher à part.

## Robustesse

- **Départs simultanés d'une tâche.** `joinTask` / `leaveTask` écrivent le
  statut puis l'inscription hors transaction : deux départs au même instant
  peuvent laisser une tâche « en cours » sans personne dessus.
- **Attribution d'un rôle sans candidature.** Un chef peut attribuer un rôle à
  un jeune qui n'a pas postulé ; la garde manque côté service.
- **Badges attribués hors de la transaction de revue.** Une course très étroite
  afficherait une erreur générique au chef alors que les points sont déjà
  versés.
- **Points affichés sur une tâche sans participant.** La file annonce « N pts
  par jeune » même quand plus personne n'est inscrit et que la validation sera
  refusée.

## Choix à trancher

- **Un chef peut s'inscrire sur une tâche** et prendre une part des points, ce
  qui dilue celle des jeunes. À interdire si ce n'est pas voulu.
- **Photo vide.** Un fichier vide est écarté silencieusement côté formulaire ;
  le message « fichier vide » du domaine n'atteint jamais l'écran.
- **Suppression d'une soumission.** La conception prévoit que supprimer une
  soumission supprime ses photos ; il n'existe pas encore de suppression.

## À faire sur le serveur, avant de s'y fier

- **Construire l'image Docker et jouer une sauvegarde-restauration complète.**
  Docker n'était pas disponible sur la machine de développement : le
  `Dockerfile`, `docker compose up`, les migrations au démarrage et
  `scripts/backup.sh` n'ont jamais tourné dans un conteneur. La sortie
  standalone, elle, a été lancée et vérifiée hors conteneur.
