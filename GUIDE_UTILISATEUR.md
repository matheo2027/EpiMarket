# Guide d'utilisation — EpiMarket

Ce guide explique comment utiliser le site, côté visiteur/parieur et côté administrateur. Pour l'installation et les détails techniques, voir [`README.md`](README.md).

## Sommaire

- [Créer un compte et se connecter](#créer-un-compte-et-se-connecter)
- [La page d'accueil](#la-page-daccueil)
- [Parcourir les marchés](#parcourir-les-marchés)
- [Comprendre un marché](#comprendre-un-marché)
- [Placer un pari](#placer-un-pari)
- [Le Profil](#le-profil)
- [Comment sont calculés les gains](#comment-sont-calculés-les-gains)
- [Le Classement](#le-classement)
- [Signaler un problème](#signaler-un-problème)
- [Espace administrateur](#espace-administrateur)
- [Questions fréquentes](#questions-fréquentes)

---

## Créer un compte et se connecter

Cliquez sur **Créer un compte** en haut à droite. Il faut un email, un nom d'utilisateur (3 caractères minimum) et un mot de passe (8 caractères minimum). Un compte démarre automatiquement avec **1000 € de portefeuille virtuel** — aucun argent réel n'est impliqué.

Une fois inscrit, vous êtes connecté automatiquement. Pour vous reconnecter plus tard, utilisez **Connexion** avec le même email et mot de passe (l'email n'est pas sensible à la casse : `Bob@Exemple.com` et `bob@exemple.com` sont le même compte).

Mot de passe oublié ? Le lien **Mot de passe oublié ?** sur la page de connexion mène à un formulaire où entrer votre email génère un lien de réinitialisation. Ce projet n'envoie pas de vrais emails : le lien s'affiche directement sur la page au lieu d'être envoyé — cliquez dessus pour choisir un nouveau mot de passe. Il expire au bout d'une heure et ne peut servir qu'une fois.

Le bouton **Déconnexion** dans le header met fin à la session sur cet appareil.

---

## La page d'accueil

En haut de la page d'accueil, un **carousel de statistiques globales** présente l'activité du site sous forme de courbes : marchés ouverts, volume total, paris actifs, parieurs. Chaque statistique a sa propre couleur ; on navigue entre elles avec les flèches sur les côtés ou en glissant (souris ou tactile). Sur une courbe, déplacez le curseur pour voir sa valeur à une date passée — pas besoin de cliquer.

En dessous, la page met en avant le **marché avec le plus gros volume** parmi les marchés ouverts, avec sa barre de répartition OUI/NON animée. Puis une grille présente les autres marchés ouverts. Un lien **Tout voir** mène à la liste complète.

Si aucun marché n'est ouvert, la page l'indique. Si le serveur est injoignable, un message d'erreur s'affiche à la place d'une page cassée.

---

## Parcourir les marchés

La page **Marchés** liste tous les marchés, avec deux filtres cumulables :

- **Statut** : Tous / Ouverts / Résolus
- **Catégorie** : Politique, Sport, Crypto, Économie, Science & Tech, Culture, Autre

Chaque marché est présenté sous forme de carte : catégorie, titre, barre de répartition OUI/NON, volume total misé, et temps restant avant la clôture (ou le résultat, s'il est déjà résolu).

---

## Comprendre un marché

Il existe deux types de marché :

- **OUI/NON** (le plus courant) : une question à laquelle la réponse est **oui ou non** (ex : *"La France remporte-t-elle l'Euro 2028 ?"*).
- **Options multiples** : une question à plusieurs réponses possibles, entre 3 et 6 (ex : *"Qui remporte le tournoi ?"* avec une option par équipe, ou une question à échéances comme sur Polymarket). Un seul camp peut gagner ; à la clôture, l'admin désigne l'option correcte.

Sur la page de détail d'un marché, vous trouverez :

- **La description générale** du marché.
- Pour un marché OUI/NON : **ce qui compte comme "oui"** et **ce qui compte comme "non"** — la règle exacte de résolution, définie par l'admin qui a créé le marché. Lisez-la avant de parier : c'est elle qui décide qui gagne.
- **La cote actuelle** : pour OUI/NON, une barre de répartition OUI/NON ; pour options multiples, une ligne par option avec son pourcentage. Ça évolue à chaque pari — c'est une estimation de la probabilité perçue par les parieurs.
- **Le graphe d'évolution du prix** : comment la cote a bougé dans le temps (une courbe OUI/NON, ou une courbe par option). Un marché tout juste créé, sans aucun pari, n'a pas encore de courbe — le graphe l'indique.
- **Le volume total** misé sur ce marché, et les **dates de début et de clôture**.

Une fois qu'un marché est **résolu**, il affiche le résultat final (OUI/NON, ou l'option gagnante) et n'accepte plus de paris.

---

## Placer un pari

Sur la page d'un marché ouvert, si vous êtes connecté, un formulaire vous permet de :

1. Choisir votre camp : **OUI** ou **NON** (ou, pour un marché à options multiples, l'une des options proposées).
2. Entrer un montant en euros (virtuels).
3. Voir un **gain estimé** avant de valider.
4. Cliquer sur **Placer le pari**.

Votre solde est immédiatement débité du montant misé, et la cote du marché se met à jour pour refléter votre pari.

**À propos du "gain estimé"** : c'est une simulation de ce que vous recevriez *si le marché se résolvait tout de suite* avec les paris actuellement en jeu. Ce n'est pas un montant garanti : comme d'autres personnes peuvent encore parier avant la clôture (dans un sens ou dans l'autre), votre gain réel à la résolution peut être différent. Voir la section suivante pour comprendre pourquoi.

Un pari ne peut être placé que si le marché est **ouvert** et dans sa **période active** (entre sa date de début et sa date de clôture). Si votre solde est insuffisant, le pari est refusé.

Changé d'avis ? Tant que le marché n'est pas résolu, vous pouvez **retirer** un pari en cours depuis votre Profil — voir la section suivante.

---

## Le Profil

Accessible via le lien **Profil** dans le header (adresse `/portefeuille`). La page affiche :

- Votre **solde disponible**, en gros et en évidence, ainsi que l'**adresse de votre wallet on-chain**.
- Vos **statistiques** : taux de réussite (sur vos paris déjà résolus), gains/pertes nets, exposition en cours (mise sur vos paris pas encore résolus, comptée à part pour ne pas fausser vos gains/pertes), une **courbe de gains/pertes cumulés** dans le temps (naviguez avec le curseur ou les flèches, comme sur l'accueil), et une **répartition par catégorie** (dans quelles catégories vous gagnez ou perdez le plus).
- Votre **historique de paris**, avec deux onglets :
  - **En cours** : paris sur des marchés pas encore résolus et pas retirés. Chacun a un bouton
    **Retirer** — annule le pari et vous rembourse exactement votre mise (ni gain, ni perte : voir
    "Puis-je annuler un pari ?" dans la FAQ).
  - **Passés** : paris sur des marchés résolus (avec le gain reçu, ou 0 € si le pari a perdu) ou que
    vous avez retirés (marqués **Retiré**, avec le montant remboursé).

Chaque pari affiche aussi le **hash de sa transaction on-chain** : la preuve qu'il correspond à une
vraie transaction sur la blockchain, pas juste une ligne dans une base de données. Chaque ligne de
l'historique renvoie vers le marché concerné.

---

## Comment sont calculés les gains

Le site utilise un modèle **pari-mutuel**, comme aux courses hippiques plutôt que comme un bookmaker à cote fixe : il n'y a pas de "maison" qui fixe un prix garanti à l'avance. À la clôture du marché, **tout l'argent réellement misé** (des deux côtés) est reversé aux gagnants, au prorata de leur mise.

**Exemple** : sur un marché qui se résout OUI, trois personnes ont parié sur OUI (10 €, 10 €, 10 €) et une personne a parié 70 € sur NON. Le pot total est de 100 €. Les 70 € du perdant sont redistribués aux trois gagnants, proportionnellement à leur mise : chacun reçoit environ 33,33 € (soit +23,33 € de gain net sur sa mise de 10 €).

**Cas particulier** : si personne n'a parié sur le camp qui gagne, tout le monde est simplement remboursé (aucun gain, aucune perte) — il n'y a personne à qui redistribuer l'argent des perdants.

Sur un marché à **options multiples**, c'est exactement le même principe, généralisé à plus de deux camps (comme une course hippique à plusieurs chevaux plutôt qu'un pari à deux issues) : tout le pot misé est reversé aux parieurs de l'option gagnante, au prorata de leur mise.

C'est pour cette raison que le "gain estimé" affiché avant de parier est une estimation, pas une garantie : le montant final dépend de qui d'autre parie, et de quel côté, avant la clôture.

---

## Le Classement

Accessible via le lien **Classement** dans le header, sans avoir besoin d'être connecté. Il liste les 50 meilleurs parieurs, classés par **gain net réalisé** (le même calcul que sur votre page Profil), du plus gros gain à la plus grosse perte. Seuls les paris déjà résolus comptent — un pari en cours n'affecte pas le classement tant que le marché n'est pas conclu. Les comptes qui n'ont encore aucun pari résolu n'apparaissent pas dans la liste.

---

## Signaler un problème

Un souci de solde, un pari qui semble avoir été placé mais qui n'apparaît nulle part ? La page **Support** (lien dans le header) permet de créer un ticket : un sujet, un message, et vous l'envoyez. Si vous arrivez sur cette page depuis un message d'erreur qui mentionne un hash de transaction (ex. après un pari qui a échoué à s'enregistrer), le formulaire est **pré-rempli automatiquement** avec ce hash pour que l'admin puisse retrouver la transaction concernée.

La même page liste vos tickets précédents avec leur statut (Ouvert / En cours / Résolu) et, une fois traités, la réponse laissée par l'admin.

---

## Espace administrateur

Réservé aux comptes avec le rôle **Admin**. Un lien **Admin** apparaît dans le header pour ces comptes, menant à `/admin`.

Un compte Admin n'a **pas de portefeuille** et **ne peut pas parier** : il n'y a ni page Profil, ni solde affiché, ni wallet on-chain provisionné pour ce rôle. C'est voulu — un admin peut créer et résoudre des marchés, il ne doit donc pas pouvoir parier dessus (conflit d'intérêt).

### Marchés

- **+ Nouveau marché** : titre, description, catégorie, date de début, date de clôture, et selon le type choisi :
  - **OUI/NON** : description du "oui", description du "non".
  - **Options multiples** : une liste de libellés (3 à 6, ajoutables/supprimables avant validation). Une option **"Autre"** est pré-remplie en dernière position par défaut — supprimez-la si elle ne convient pas, ou ajoutez d'autres options avant elle, elle reste toujours en dernier. Le type et le nombre d'options ne peuvent plus changer après la création (fixés sur la blockchain) ; les libellés eux-mêmes restent modifiables via **Éditer**.
- **Éditer** : modifie un marché — impossible une fois qu'il est résolu.
- **Conclure OUI / Conclure NON** (marché OUI/NON) ou **choisir l'option gagnante puis Conclure** (marché à options multiples) : clôture le marché sur ce résultat et **règle les gains immédiatement** (voir la section précédente). Une confirmation est demandée : cette action est irréversible.
- **Supprimer** : possible uniquement si le marché n'a encore reçu aucun pari et n'est pas résolu (pour ne jamais perdre un historique de paris ou de résolution).

### Paris

Liste de tous les paris, tous utilisateurs confondus, avec mise, camp, gain, statut et hash de
transaction. Un pari ne peut pas être annulé une fois placé : la mise est immédiatement verrouillée
sur la blockchain, il n'existe pas de mécanisme pour la reprendre.

### Utilisateurs

- Créer un utilisateur (y compris un autre compte admin).
- Modifier le rôle d'un utilisateur existant.
- Supprimer un utilisateur — impossible s'il a déjà parié, et impossible de se supprimer soi-même.

### Tickets

Liste tous les tickets envoyés par les utilisateurs via la page Support (sujet, message, auteur, et le hash de transaction lié le cas échéant). Pour chaque ticket, changez son statut (Ouvert / En cours / Résolu) et laissez une note qui sera visible par l'utilisateur, puis **Enregistrer**.

### Diagnostics

Un tableau de bord qui détecte automatiquement les cas où la base de données et la blockchain ne sont plus d'accord — typiquement après un souci réseau ou un redémarrage de la chaîne de test :

- **Marchés désynchronisés** : un marché existe en base mais pas sur la blockchain (les paris dessus échoueraient). Bouton **Recréer on-chain**.
- **Paris bloqués** : un marché est résolu mais un pari dessus n'a jamais reçu son gain calculé. Bouton **Resynchroniser le gain**.
- **Soldes désynchronisés** : le solde affiché pour un utilisateur ne correspond plus à son solde réel sur la blockchain. Bouton **Resynchroniser le solde**.

Si tout est cohérent, chaque section affiche simplement une coche verte. Chaque bouton de correction déclenche une vraie action (transaction blockchain ou relecture du solde réel) et demande une confirmation avant de s'exécuter, comme les autres actions sensibles de l'espace admin.

Si vous ouvrez cette page juste après avoir démarré le projet, un message "Blockchain locale en cours de démarrage…" peut s'afficher quelques secondes : la page réessaie toute seule en arrière-plan, pas besoin de recharger.

Toutes les actions destructrices ou irréversibles (conclure, supprimer, resynchroniser) demandent une confirmation via une fenêtre du site avant d'être exécutées.

---

## Questions fréquentes

**Je peux perdre de l'argent réel ?**
Non. Le portefeuille est entièrement virtuel, à but pédagogique.

**Pourquoi la cote d'un marché tout juste créé est-elle à 50/50 ?**
Un marché démarre neutre : sans pari, il n'y a pas encore d'information pour pencher d'un côté ou de l'autre.

**Pourquoi mon pari a-t-il été refusé alors que le marché semblait ouvert ?**
Le marché a probablement été résolu entre le moment où vous avez ouvert la page et celui où vous avez validé le pari (ou votre solde est insuffisant). Rechargez la page pour voir son état actuel.

**Puis-je annuler un pari ?**
Oui, tant que le marché n'est pas résolu : depuis votre Profil, un pari "En cours" a un bouton **Retirer** qui vous rembourse exactement votre mise (ni gain, ni perte). Une fois le marché résolu, ce n'est plus possible, ni pour vous ni pour un administrateur.

**Que veut dire "payout: 0 €" sur un pari passé ?**
Le pari a perdu — vous n'avez pas récupéré votre mise. C'est différent d'un pari "en attente" (marché pas encore résolu), affiché sans montant.

**J'ai un message d'erreur qui parle d'une transaction mais mon pari n'apparaît pas, que faire ?**
Utilisez la page **Support** pour créer un ticket — le hash de transaction de l'erreur est repris automatiquement si vous y arrivez via le lien affiché dans le message d'erreur. Un admin pourra vérifier la transaction et resynchroniser votre compte si besoin.
