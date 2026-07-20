# API — Base de données

Backend Express/TypeScript. La base de données est PostgreSQL, accédée via [Prisma](https://www.prisma.io/) (ORM + migrations). Le schéma source de vérité est `prisma/schema.prisma`.

## Configuration / identifiants

Deux fichiers `.env` distincts :

- **`.env` à la racine du repo** — identifiants PostgreSQL utilisés par `docker-compose.yml` pour créer le conteneur (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`).
- **`apps/api/.env`** — utilisé par Prisma/Express. Contient `DATABASE_URL`, qui doit pointer vers les mêmes identifiants que le `.env` racine, plus `PORT` (port de l'API), `JWT_SECRET`, `FRONTEND_URL` (origine(s) autorisée(s) en CORS) et les variables du POC blockchain (`WALLET_ENCRYPTION_KEY`, `HARDHAT_RPC_URL`, `HARDHAT_FUNDER_PRIVATE_KEY` — voir la section Intégration blockchain plus bas).

Si tu changes les identifiants dans le `.env` racine, mets à jour `DATABASE_URL` dans `apps/api/.env` en conséquence.

## Commandes utiles

```bash
npx prisma migrate dev --name <nom>   # créer + appliquer une migration après modif du schema
npx prisma generate                    # régénérer le client Prisma (auto après migrate)
npx prisma studio                      # interface graphique pour explorer les données
npm run db:seed                        # crée un compte admin de test (admin@epitech.eu / admin1234)
```

## Schéma

### `User`

Compte utilisateur + portefeuille virtuel.

| Champ           | Type       | Notes                                 |
| --------------- | ---------- | -------------------------------------- |
| `id`             | `String`   | cuid                                   |
| `email`          | `String`   | unique                                 |
| `username`       | `String`   | unique                                 |
| `passwordHash`   | `String`   | bcrypt, jamais le mot de passe en clair |
| `role`           | `Role`     | `USER` \| `ADMIN`                       |
| `walletBalance`  | `Decimal`  | miroir du solde on-chain réel (0 par défaut, mis à jour après chaque mint/pari/résolution — voir `syncUserBalance`, section Intégration blockchain plus bas) |
| `walletAddress`  | `String?`  | adresse du wallet custodial on-chain, en clair. Nullable : lignes existantes avant l'ajout du POC blockchain, et surtout tout compte `ADMIN` (jamais provisionné, voir plus bas) |
| `encryptedPrivateKey` | `String?` | clé privée du wallet, chiffrée au repos (AES-256-GCM, voir `src/blockchain/wallet.ts`). Jamais renvoyée par l'API |
| `createdAt`      | `DateTime` |                                         |

Relation : un `User` a plusieurs `Bet`.

### `Market`

Un marché de prédiction. Deux types, distingués par `type` :

- `BINARY` (par défaut) — oui/non, le modèle historique, décrit ci-dessous.
- `MULTI` — plusieurs issues (3 à 6), voir [Marchés à options multiples](#marchés-à-options-multiples) plus bas.

| Champ             | Type             | Notes                                                        |
| ----------------- | ---------------- | -------------------------------------------------------------- |
| `id`                | `String`         | cuid                                                            |
| `title`             | `String`         | question du marché                                              |
| `description`       | `String`         | description générale                                            |
| `type`              | `MarketType`     | `BINARY` \| `MULTI`                                              |
| `yesDescription`    | `String?`        | ce qui compte comme "oui" — `BINARY` uniquement, `null` pour `MULTI` |
| `noDescription`     | `String?`        | ce qui compte comme "non" — `BINARY` uniquement, `null` pour `MULTI` |
| `category`          | `MarketCategory` | `POLITICS`, `SPORTS`, `CRYPTO`, `ECONOMY`, `SCIENCE_TECH`, `POP_CULTURE`, `OTHER` |
| `status`            | `MarketStatus`   | `OPEN` \| `RESOLVED`                                             |
| `resolvedOutcome`   | `BetSide?`       | `YES` \| `NO`, rempli seulement pour un marché `BINARY` conclu   |
| `resolvedOptionId`  | `String?`        | FK vers `MarketOption`, rempli seulement pour un marché `MULTI` conclu |
| `startDate`         | `DateTime`       | début du marché                                                 |
| `endDate`           | `DateTime`       | fin prévue                                                       |
| `yesPool`/`noPool`  | `Decimal`        | liquidités virtuelles utilisées pour calculer la cote (`BINARY`, voir plus bas) |
| `totalVolume`       | `Decimal`        | somme des montants réellement misés sur ce marché (hors liquidité virtuelle de départ) |
| `createdAt`         | `DateTime`       |                                                                  |
| `resolvedAt`        | `DateTime?`      |                                                                  |

Relations : un `Market` a plusieurs `Bet`, plusieurs `PricePoint` et (pour `MULTI`) plusieurs `MarketOption`.

**Cotes yes/no** : modèle pari-mutuel simplifié. `yesPool`/`noPool` représentent la somme cumulée misée sur chaque camp (initialisées à 50/50 comme liquidité virtuelle de départ, pour éviter une division par zéro et démarrer à une cote 50/50). Le prix (probabilité implicite) du "oui" se calcule comme `yesPool / (yesPool + noPool)` — plus les paris "oui" affluent, plus `yesPool` grandit et plus le prix du "oui" augmente. Voir `src/pricing.ts`. Chaque pari incrémente le pool du camp choisi et `totalVolume`, et log un `PricePoint` avec le nouveau prix.

### `MarketOption`

Une option d'un marché `MULTI` (ex. "Équipe A"). N'existe que pour ce type de marché.

| Champ       | Type      | Notes                                              |
| ----------- | --------- | ----------------------------------------------------- |
| `id`          | `String`  | cuid                                                  |
| `label`       | `String`  | libellé affiché (ex. "31 août", "Équipe A")           |
| `sortOrder`   | `Int`     | ordre d'affichage, fixé à la création (0-indexé) — c'est aussi l'index utilisé on-chain (`placeMultiBet`/`resolveMultiMarket`) |
| `pool`        | `Decimal` | liquidité cumulée misée sur cette option (virtuelle 50 de départ incluse, même convention que `yesPool`/`noPool`) |
| `marketId`    | `String`  | FK vers `Market`, `onDelete: Cascade`                 |

**Cote d'une option** : `pool_i / somme(tous les pools)`, généralisation directe de la formule OUI/NON à N options (`computeOptionPrices` dans `src/pricing.ts`).

### `Bet`

Un pari placé par un utilisateur sur un marché.

| Champ       | Type       | Notes                                    |
| ----------- | ---------- | ------------------------------------------ |
| `id`          | `String`   | cuid                                       |
| `side`        | `BetSide?` | `YES` \| `NO` — pari sur un marché `BINARY`, `null` pour un marché `MULTI` |
| `optionId`    | `String?`  | FK vers `MarketOption` — pari sur un marché `MULTI`, `null` pour un marché `BINARY` |
| `amount`      | `Decimal`  | montant misé                               |
| `price`       | `Decimal`  | prix du camp/de l'option choisi au moment du pari (0 à 1) |
| `payout`      | `Decimal?` | `null` tant que le marché est ouvert, sinon montant reçu (0 si perdant) — copié depuis le contrat, jamais recalculé en TypeScript |
| `txHash`      | `String?`  | hash de la transaction `placeBet`/`placeMultiBet` on-chain, preuve du pari réel sur la chaîne |
| `createdAt`   | `DateTime` |                                             |
| `userId`      | `String`   | FK vers `User`                             |
| `marketId`    | `String`   | FK vers `Market`                           |

Exactement un de `side`/`optionId` est renseigné, selon `market.type`.

### `PricePoint` / `OptionPricePoint`

Historique du prix, pour le graphe d'évolution. `PricePoint` (prix du "oui") pour un marché `BINARY`,
`OptionPricePoint` (prix d'une option) pour un marché `MULTI` — deux modèles séparés plutôt qu'un
champ `optionId` optionnel sur `PricePoint`, pour ne rien changer au modèle existant.

| Champ       | Type       | Notes                        |
| ----------- | ---------- | ------------------------------ |
| `id`          | `String`   | cuid                          |
| `yesPrice` / `price` | `Decimal` | prix à cet instant   |
| `timestamp`   | `DateTime` |                               |
| `marketId` / `optionId` | `String` | FK vers `Market` / `MarketOption` |

Un point est créé à chaque pari pour tracer la courbe (pour `MULTI`, un point par option à la même
date, pour que les N courbes restent synchronisées sur le même axe des temps).

### `Ticket`

Un signalement de problème créé par un utilisateur (ex. solde qui ne correspond pas, pari qui n'apparaît pas), traité par un admin.

| Champ         | Type           | Notes                                                        |
| ------------- | -------------- | -------------------------------------------------------------- |
| `id`            | `String`       | cuid                                                            |
| `subject`       | `String`       | résumé du problème                                              |
| `message`       | `String`       | description                                                     |
| `status`        | `TicketStatus` | `OPEN` \| `IN_PROGRESS` \| `RESOLVED`                             |
| `adminNote`     | `String?`      | réponse/note laissée par l'admin qui traite le ticket           |
| `txHash`        | `String?`      | hash de transaction lié, si le ticket vient d'une erreur de pari |
| `createdAt`     | `DateTime`     |                                                                  |
| `resolvedAt`    | `DateTime?`    | posé automatiquement au passage à `RESOLVED`                     |
| `userId`        | `String`       | FK vers `User`, auteur du ticket                                |
| `betId`         | `String?`      | FK optionnelle vers `Bet`, si le ticket concerne un pari précis  |
| `marketId`      | `String?`      | FK optionnelle vers `Market`                                    |

## Routes

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me` — `register`/`login` sont limités à 10
  tentatives / 15 min par IP (`express-rate-limit`) pour freiner le brute-force.
- `GET /markets`, `GET /markets/:id` — public. Renvoie `options` (avec le prix courant de chacune) pour
  un marché `MULTI`.
- `GET /markets/:id/price-history` — public. Pour un marché `BINARY`, liste des `PricePoint` triés par
  date. Pour un marché `MULTI`, `{ options, optionPricePoints }` (une liste d'`OptionPricePoint` par
  option). Le point de départ (0.5, ou 1/N par option) est créé automatiquement à la création du marché.
- `GET /markets/stats/history` — public, série quotidienne (marchés ouverts, volume, paris actifs,
  parieurs distincts) reconstruite depuis l'historique des marchés/paris existants, pour les courbes de
  la page d'accueil.
- `POST /markets`, `PATCH /markets/:id`, `DELETE /markets/:id`, `POST /markets/:id/resolve` — admin.
  `POST` accepte `type: "BINARY" | "MULTI"` (par défaut `BINARY`) ; pour `MULTI`, `options` (3 à 6
  libellés) remplace `yesDescription`/`noDescription`. `PATCH`/`DELETE` refusés si le marché est déjà
  résolu ; `DELETE` refusé aussi s'il a déjà des paris (résous-le plutôt que de le supprimer). `PATCH`
  sur un marché `MULTI` peut renommer les options (`options`, même longueur exacte que l'existant — le
  nombre d'options est fixé on-chain à la création et ne peut plus changer). `POST /:id/resolve` attend
  `{ outcome: "YES" | "NO" }` pour `BINARY` ou `{ optionId }` pour `MULTI` ; il est rappelable sans effet
  de bord : si un premier appel a résolu le marché on-chain mais échoué à synchroniser les gains/soldes
  en Postgres, un second appel avec le même `outcome`/`optionId` reprend uniquement la synchronisation au
  lieu de renvoyer une erreur bloquante (voir aussi `POST /diagnostics/resync-*` plus bas, qui s'appuie
  sur ce même mécanisme).
- `POST /bets` — placer un pari (utilisateur connecté, refusé avec `403` pour un compte `ADMIN` — voir
  plus bas). Attend `{ marketId, side, amount }` pour un marché `BINARY` ou `{ marketId, optionId, amount }`
  pour `MULTI`. Signe et envoie un vrai `placeBet`/`placeMultiBet` on-chain avec le wallet custodial de
  l'utilisateur, attend la confirmation, puis reflète le résultat en Postgres (pools/volume/solde relus
  depuis le contrat, jamais recalculés en TS) dans une seule transaction Postgres, elle-même protégée par
  un `try/catch` : si la synchro échoue après une transaction on-chain déjà confirmée, l'API répond avec
  le `txHash` de la transaction plutôt qu'une erreur générique, pour que l'utilisateur puisse le signaler
  (voir `POST /tickets`). Un revert Solidity (solde insuffisant, marché fermé...) devient un 400 avec le
  message du contrat.
- `GET /bets?status=ongoing|past` — historique des paris de l'utilisateur connecté, filtrable par marché en cours (`OPEN`) ou passé (`RESOLVED`)
- `GET /bets?all=true` — (admin) tous les paris, tous utilisateurs confondus
- `GET /bets/:id` — un pari (propriétaire ou admin)
- `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` — (admin) CRUD utilisateurs. `DELETE` refusé si l'utilisateur a déjà des paris, ou si tu essaies de te supprimer toi-même. `PATCH` ne permet plus de modifier `walletBalance` (c'est un miroir on-chain, l'éditer directement n'aurait aucun effet durable).
- `GET /users/:id` — soi-même ou admin
- `GET /users/stats` — (admin) compteurs globaux (utilisateurs, marchés ouverts/résolus, paris, volume) pour le bandeau en haut des pages admin.
- `GET /users/leaderboard` — public. Top 50 utilisateurs classés par gain net réalisé (`payout - amount`
  sur leurs paris résolus uniquement, même définition que les stats de la page Profil), agrégé
  directement en base (`prisma.bet.groupBy`) plutôt que de recalculer côté client. Les utilisateurs sans
  aucun pari résolu n'apparaissent pas. Doit rester déclarée avant `GET /users/:id` (sinon Express
  interprète `leaderboard` comme un `:id`).
- `POST /tickets` — créer un ticket de support (utilisateur connecté), avec `betId`/`marketId`/`txHash` optionnels pour le lier à un pari précis.
- `GET /tickets` — les tickets de l'utilisateur connecté ; `GET /tickets?all=true` (admin) — tous les tickets, avec l'auteur.
- `GET /tickets/:id` — un ticket (propriétaire ou admin).
- `PATCH /tickets/:id` — (admin) changer le `status` et/ou `adminNote` ; pose `resolvedAt` automatiquement en passant à `RESOLVED`.
- `GET /diagnostics` — (admin) rapport de cohérence base ↔ blockchain : marchés `OPEN` absents on-chain (`BINARY` et `MULTI` tous deux vérifiés), paris sur un marché résolu sans `payout` calculé, utilisateurs dont `walletBalance` diverge du solde réel on-chain.
- `POST /diagnostics/resync-market/:id` — (admin) recrée un marché manquant on-chain (`createMarket` pour `BINARY`, `createMultiMarket` pour `MULTI`).
- `POST /diagnostics/resync-balance/:userId` — (admin) réaligne `walletBalance` sur le solde réel on-chain pour un utilisateur.
- Les trois routes `/diagnostics*` renvoient `503 { error, retryable: true }` (au lieu de planter) si le nœud Hardhat n'est pas encore joignable (`isBlockchainUnavailable()` dans `src/blockchain/contract.ts`, détecte les erreurs de type `NETWORK_ERROR`/`ECONNREFUSED`/`ECONNRESET`) — typiquement dans les premières secondes après `npm run dev`, le temps que le service `hardhat` finisse de démarrer. Le frontend (`apps/web/src/app/admin/diagnostics/page.tsx`) réessaie automatiquement dans ce cas.

## Règlement des gains (settlement)

Depuis l'intégration blockchain (voir plus bas), le calcul du règlement ne vit plus en TypeScript : il
est fait par le contrat `EpiMarket` (`resolveMarket`/`resolveMultiMarket` dans
`apps/blockchain/contracts/EpiMarket.sol`). Quand un marché est conclu (`POST /markets/:id/resolve`), la
route :

1. Appelle `resolveMarket`/`resolveMultiMarket` on-chain selon `market.type` (signé par le wallet owner
   du contrat) et attend la confirmation.
2. Relit chaque pari via `getBet`/`getMultiBet` (le contrat expose maintenant le `payout` calculé par
   pari) et le recopie dans `Bet.payout` — aucune formule pari-mutuel dupliquée côté API.
3. Relit `balanceOf` pour chaque parieur concerné et met à jour `User.walletBalance`.

Ces étapes 2-3 sont enveloppées dans une seule transaction Postgres (tout-ou-rien), pour que le miroir
ne reste jamais à moitié synchronisé si l'une des écritures échoue en cours de route — l'état on-chain,
lui, a déjà été tranché de façon irréversible à l'étape 1.

Modèle pari-mutuel (implémenté en Solidity, pas ici) : les gagnants se partagent l'intégralité de
l'argent réellement misé sur ce marché (pas les pools virtuels de départ), proportionnellement à leur
mise. Si personne n'a parié sur le camp gagnant, tout le monde est remboursé (push).

Un pari ne peut plus être annulé une fois placé : le contrat n'a aucune fonction pour ça (l'argent est
escrow on-chain dès `placeBet`), donc il n'existe pas de route d'annulation côté API.

## Intégration blockchain (POC Hardhat)

Voir [`apps/blockchain/README.md`](../blockchain/README.md) pour le contrat, ses tests et son
déploiement. Ici, le résumé côté backend :

- Chaque `User` a un wallet custodial généré à la création (adresse en clair, clé privée chiffrée
  AES-256-GCM avec `WALLET_ENCRYPTION_KEY`, format stocké `iv:authTag:ciphertext`) — voir
  `src/blockchain/wallet.ts`. Choix custodial assumé : pas de wallet externe (MetaMask ou autre), le
  backend signe les transactions à la place de l'utilisateur, qui n'a rien à installer ni à gérer.
- Un seul contrat `EpiMarket` (`apps/blockchain/contracts/EpiMarket.sol`) sert à la fois de token
  ERC-20 (le solde) et de logique de paris/règlement (pari-mutuel), pour qu'un pari soit une seule
  transaction on-chain.
- `src/blockchain/contract.ts` expose trois façons de parler au contrat : `getReadOnlyContract()`
  (lectures), `getOwnerContract()` (créer/résoudre un marché, mint — signé par le wallet owner du
  contrat), `getUserContract(user)` (un pari, signé par le wallet du parieur, gas à sa charge).
- `src/blockchain/provider.ts` sérialise les transactions du wallet owner (`runAsOwner`) : plusieurs
  appels owner concurrents (inscriptions, résolutions) partagent le même compte et se prendraient sinon
  des collisions de nonce.
- Chaque nouveau compte est crédité en ETH de test (`fundWallet`) pour payer le gas de ses futures
  transactions, distribué par le compte owner du contrat — pas de vraie économie de gas à gérer sur un
  réseau local.
- Le nœud Hardhat local tourne via `docker-compose.yml` (service `hardhat`) ou `npx hardhat node` en
  dev ; `apps/blockchain/scripts/deploy.ts` déploie le contrat et écrit son adresse/ABI dans
  `src/blockchain/deployment.json` (gitignored, régénéré à chaque déploiement).

## Sécurité et gestion de la concurrence

- **Rôle vérifié en base, pas dans le token.** Le JWT est valable 7 jours. Si un admin est rétrogradé, son token reste techniquement valide mais son rôle est revérifié en base à chaque requête sensible (`currentUserRole()` dans `src/middleware/auth.ts`, utilisé par `requireAdmin` et par les routes qui font un contrôle "propriétaire ou admin"). Un admin rétrogradé perd donc l'accès immédiatement, pas seulement à l'expiration du token.
- **Emails normalisés.** `email` est toujours comparé en minuscules/sans espaces (`auth.ts`, `users.ts`), pour éviter qu'un même email avec une casse différente crée un doublon ou bloque la connexion.
- **L'argent est gardé par le contrat, pas par Postgres.** Depuis l'intégration blockchain, "solde
  suffisant" et "marché encore ouvert" sont des `require()` Solidity qui s'exécutent atomiquement
  on-chain (`placeBet`/`resolveMarket` dans `EpiMarket.sol`) — impossible de miser plus que son solde
  ou de parier sur un marché qui vient d'être conclu, quel que soit le nombre de requêtes concurrentes.
  Postgres ne fait plus qu'un miroir best-effort de ce qui s'est passé on-chain, écrit dans une
  transaction Postgres (tout-ou-rien) après confirmation de la transaction on-chain.
  - Conclure un marché reste protégé côté Postgres par un `updateMany` conditionné à `status = OPEN`
    (garde rapide, sans aller-retour chaîne, contre un double-clic sur "Conclure") — mais la vraie
    garantie anti-double-résolution est le `require(!market.resolved)` du contrat.
  - Inscription / création d'utilisateur : la création est protégée par la contrainte d'unicité de la base (capturée via le code d'erreur Prisma `P2002`), pas seulement par une vérification préalable.
- **Un admin ne peut pas parier.** Un admin peut créer et résoudre un marché ; s'il pouvait aussi
  parier dessus, il pourrait miser puis résoudre en sa faveur (conflit d'intérêt). `POST /bets` renvoie
  `403` si `user.role === "ADMIN"` (`src/routes/bets.ts`). Pour que ça reste vrai même en cas de bug
  d'autorisation, un compte `ADMIN` n'a **jamais** de wallet custodial provisionné (`walletAddress`/
  `encryptedPrivateKey` restent `null` — `POST /users` dans `src/routes/users.ts` saute la génération de
  wallet et le mint pour ce rôle), donc il n'a de toute façon rien à miser.
- **Aucune requête ne peut faire planter le serveur.** `express-async-errors` est importé en premier dans `src/index.ts` pour qu'une promesse rejetée dans une route `async` soit automatiquement transmise au middleware d'erreur final, qui répond `500` proprement au lieu de laisser le process planter (Express 4 ne le fait pas nativement).

## Diagramme

```
User ──< Bet >── Market ──< PricePoint
User ──< Ticket >── (Bet, Market optionnels)
```

- Un `User` peut avoir plusieurs `Bet` et plusieurs `Ticket`.
- Un `Market` peut avoir plusieurs `Bet`, plusieurs `PricePoint`, et être référencé par des `Ticket`.
