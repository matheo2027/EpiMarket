# Guide d'utilisation — EpiMarket

Ce guide explique comment utiliser le site, côté visiteur/parieur et côté administrateur. Pour l'installation et les détails techniques, voir [`README.md`](README.md).

## Sommaire

- [Créer un compte et se connecter](#créer-un-compte-et-se-connecter)
- [La page d'accueil](#la-page-daccueil)
- [Parcourir les marchés](#parcourir-les-marchés)
- [Comprendre un marché](#comprendre-un-marché)
- [Placer un pari](#placer-un-pari)
- [Le portefeuille](#le-portefeuille)
- [Comment sont calculés les gains](#comment-sont-calculés-les-gains)
- [Espace administrateur](#espace-administrateur)
- [Questions fréquentes](#questions-fréquentes)

---

## Créer un compte et se connecter

Cliquez sur **Créer un compte** en haut à droite. Il faut un email, un nom d'utilisateur (3 caractères minimum) et un mot de passe (8 caractères minimum). Un compte démarre automatiquement avec **1000 € de portefeuille virtuel** — aucun argent réel n'est impliqué.

Une fois inscrit, vous êtes connecté automatiquement. Pour vous reconnecter plus tard, utilisez **Connexion** avec le même email et mot de passe (l'email n'est pas sensible à la casse : `Bob@Exemple.com` et `bob@exemple.com` sont le même compte).

Le bouton **Déconnexion** dans le header met fin à la session sur cet appareil.

---

## La page d'accueil

La page d'accueil met en avant le **marché avec le plus gros volume** parmi les marchés ouverts, avec sa barre de répartition OUI/NON animée. En dessous, une grille présente les autres marchés ouverts. Un lien **Tout voir** mène à la liste complète.

Si aucun marché n'est ouvert, la page l'indique. Si le serveur est injoignable, un message d'erreur s'affiche à la place d'une page cassée.

---

## Parcourir les marchés

La page **Marchés** liste tous les marchés, avec deux filtres cumulables :

- **Statut** : Tous / Ouverts / Résolus
- **Catégorie** : Politique, Sport, Crypto, Économie, Science & Tech, Culture, Autre

Chaque marché est présenté sous forme de carte : catégorie, titre, barre de répartition OUI/NON, volume total misé, et temps restant avant la clôture (ou le résultat, s'il est déjà résolu).

---

## Comprendre un marché

Un marché pose une question à laquelle la réponse est **oui ou non** (ex : *"La France remporte-t-elle l'Euro 2028 ?"*). Sur sa page de détail, vous trouverez :

- **La description générale** du marché.
- **Ce qui compte comme "oui"** et **ce qui compte comme "non"** — la règle exacte de résolution, définie par l'admin qui a créé le marché. Lisez-la avant de parier : c'est elle qui décide qui gagne.
- **La barre de répartition** : le pourcentage actuel associé à OUI et à NON. Ce pourcentage évolue à chaque pari — c'est la "cote" du marché, une estimation de la probabilité perçue par les parieurs.
- **Le graphe d'évolution du prix** : comment la cote du OUI a bougé dans le temps. Un marché tout juste créé, sans aucun pari, n'a pas encore de courbe — le graphe l'indique.
- **Le volume total** misé sur ce marché, et les **dates de début et de clôture**.

Une fois qu'un marché est **résolu**, il affiche le résultat final (OUI ou NON) et n'accepte plus de paris.

---

## Placer un pari

Sur la page d'un marché ouvert, si vous êtes connecté, un formulaire vous permet de :

1. Choisir votre camp : **OUI** ou **NON**.
2. Entrer un montant en euros (virtuels).
3. Voir un **gain estimé** avant de valider.
4. Cliquer sur **Placer le pari**.

Votre solde est immédiatement débité du montant misé, et la cote du marché se met à jour pour refléter votre pari.

**À propos du "gain estimé"** : c'est une simulation de ce que vous recevriez *si le marché se résolvait tout de suite* avec les paris actuellement en jeu. Ce n'est pas un montant garanti : comme d'autres personnes peuvent encore parier avant la clôture (dans un sens ou dans l'autre), votre gain réel à la résolution peut être différent. Voir la section suivante pour comprendre pourquoi.

Un pari ne peut être placé que si le marché est **ouvert** et dans sa **période active** (entre sa date de début et sa date de clôture). Si votre solde est insuffisant, le pari est refusé.

---

## Le portefeuille

La page **Portefeuille** affiche :

- Votre **solde disponible**, en gros et en évidence, ainsi que l'**adresse de votre wallet on-chain**.
- Votre **historique de paris**, avec deux onglets :
  - **En cours** : paris sur des marchés pas encore résolus.
  - **Passés** : paris sur des marchés résolus, avec le gain reçu (ou 0 € si le pari a perdu).

Chaque pari affiche aussi le **hash de sa transaction on-chain** : la preuve qu'il correspond à une
vraie transaction sur la blockchain, pas juste une ligne dans une base de données. Chaque ligne de
l'historique renvoie vers le marché concerné.

---

## Comment sont calculés les gains

Le site utilise un modèle **pari-mutuel**, comme aux courses hippiques plutôt que comme un bookmaker à cote fixe : il n'y a pas de "maison" qui fixe un prix garanti à l'avance. À la clôture du marché, **tout l'argent réellement misé** (des deux côtés) est reversé aux gagnants, au prorata de leur mise.

**Exemple** : sur un marché qui se résout OUI, trois personnes ont parié sur OUI (10 €, 10 €, 10 €) et une personne a parié 70 € sur NON. Le pot total est de 100 €. Les 70 € du perdant sont redistribués aux trois gagnants, proportionnellement à leur mise : chacun reçoit environ 33,33 € (soit +23,33 € de gain net sur sa mise de 10 €).

**Cas particulier** : si personne n'a parié sur le camp qui gagne, tout le monde est simplement remboursé (aucun gain, aucune perte) — il n'y a personne à qui redistribuer l'argent des perdants.

C'est pour cette raison que le "gain estimé" affiché avant de parier est une estimation, pas une garantie : le montant final dépend de qui d'autre parie, et de quel côté, avant la clôture.

---

## Espace administrateur

Réservé aux comptes avec le rôle **Admin**. Un lien **Admin** apparaît dans le header pour ces comptes, menant à `/admin`.

Un compte Admin n'a **pas de portefeuille** et **ne peut pas parier** : il n'y a ni page Portefeuille, ni solde affiché, ni wallet on-chain provisionné pour ce rôle. C'est voulu — un admin peut créer et résoudre des marchés, il ne doit donc pas pouvoir parier dessus (conflit d'intérêt).

### Marchés

- **+ Nouveau marché** : titre, description, description du "oui", description du "non", catégorie, date de début, date de clôture.
- **Éditer** : modifie un marché — impossible une fois qu'il est résolu.
- **Conclure OUI / Conclure NON** : clôture le marché sur ce résultat et **règle les gains immédiatement** (voir la section précédente). Une confirmation est demandée : cette action est irréversible.
- **Supprimer** : possible uniquement si le marché n'a encore reçu aucun pari et n'est pas résolu (pour ne jamais perdre un historique de paris ou de résolution).

### Paris

Liste de tous les paris, tous utilisateurs confondus, avec mise, camp, gain, statut et hash de
transaction. Un pari ne peut pas être annulé une fois placé : la mise est immédiatement verrouillée
sur la blockchain, il n'existe pas de mécanisme pour la reprendre.

### Utilisateurs

- Créer un utilisateur (y compris un autre compte admin).
- Modifier le rôle d'un utilisateur existant.
- Supprimer un utilisateur — impossible s'il a déjà parié, et impossible de se supprimer soi-même.

Toutes les actions destructrices (conclure, supprimer) demandent une confirmation via une fenêtre du site avant d'être exécutées.

---

## Questions fréquentes

**Je peux perdre de l'argent réel ?**
Non. Le portefeuille est entièrement virtuel, à but pédagogique.

**Pourquoi la cote d'un marché tout juste créé est-elle à 50/50 ?**
Un marché démarre neutre : sans pari, il n'y a pas encore d'information pour pencher d'un côté ou de l'autre.

**Pourquoi mon pari a-t-il été refusé alors que le marché semblait ouvert ?**
Le marché a probablement été résolu entre le moment où vous avez ouvert la page et celui où vous avez validé le pari (ou votre solde est insuffisant). Rechargez la page pour voir son état actuel.

**Puis-je annuler un pari ?**
Non, ni vous ni un administrateur : une fois placé, un pari verrouille votre mise sur la blockchain et il n'existe aucun mécanisme pour l'annuler. Vérifiez bien votre choix (camp et montant) avant de valider.

**Que veut dire "payout: 0 €" sur un pari passé ?**
Le pari a perdu — vous n'avez pas récupéré votre mise. C'est différent d'un pari "en attente" (marché pas encore résolu), affiché sans montant.
