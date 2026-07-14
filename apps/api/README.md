# API — Base de données

Backend Express/TypeScript. La base de données est PostgreSQL, accédée via [Prisma](https://www.prisma.io/) (ORM + migrations). Le schéma source de vérité est `prisma/schema.prisma`.

## Configuration / identifiants

Deux fichiers `.env` distincts :

- **`.env` à la racine du repo** — identifiants PostgreSQL utilisés par `docker-compose.yml` pour créer le conteneur (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`).
- **`apps/api/.env`** — utilisé par Prisma/Express. Contient `DATABASE_URL`, qui doit pointer vers les mêmes identifiants que le `.env` racine, plus `PORT` (port de l'API) et `JWT_SECRET`.

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
| `walletBalance`  | `Decimal`  | solde du portefeuille, démarre à 1000  |
| `createdAt`      | `DateTime` |                                         |

Relation : un `User` a plusieurs `Bet`.

### `Market`

Un marché de prédiction binaire (oui/non).

| Champ             | Type             | Notes                                                        |
| ----------------- | ---------------- | -------------------------------------------------------------- |
| `id`                | `String`         | cuid                                                            |
| `title`             | `String`         | question du marché                                              |
| `description`       | `String`         | description générale                                            |
| `yesDescription`    | `String`         | ce qui compte comme "oui"                                       |
| `noDescription`     | `String`         | ce qui compte comme "non"                                       |
| `category`          | `MarketCategory` | `POLITICS`, `SPORTS`, `CRYPTO`, `ECONOMY`, `SCIENCE_TECH`, `POP_CULTURE`, `OTHER` |
| `status`            | `MarketStatus`   | `OPEN` \| `RESOLVED`                                             |
| `resolvedOutcome`   | `BetSide?`       | `YES` \| `NO`, rempli seulement quand le marché est conclu       |
| `startDate`         | `DateTime`       | début du marché                                                 |
| `endDate`           | `DateTime`       | fin prévue                                                       |
| `yesPool`/`noPool`  | `Decimal`        | liquidités virtuelles utilisées pour calculer la cote (voir plus bas) |
| `totalVolume`       | `Decimal`        | somme des montants misés sur ce marché                          |
| `createdAt`         | `DateTime`       |                                                                  |
| `resolvedAt`        | `DateTime?`      |                                                                  |

Relations : un `Market` a plusieurs `Bet` et plusieurs `PricePoint`.

**Cotes yes/no** : modèle pari-mutuel simplifié. `yesPool`/`noPool` représentent la somme cumulée misée sur chaque camp (initialisées à 50/50 comme liquidité virtuelle de départ, pour éviter une division par zéro et démarrer à une cote 50/50). Le prix (probabilité implicite) du "oui" se calcule comme `yesPool / (yesPool + noPool)` — plus les paris "oui" affluent, plus `yesPool` grandit et plus le prix du "oui" augmente. Voir `src/pricing.ts`. Chaque pari incrémente le pool du camp choisi et `totalVolume`, et log un `PricePoint` avec le nouveau prix.

### `Bet`

Un pari placé par un utilisateur sur un marché.

| Champ       | Type       | Notes                                    |
| ----------- | ---------- | ------------------------------------------ |
| `id`          | `String`   | cuid                                       |
| `side`        | `BetSide`  | `YES` \| `NO`                               |
| `amount`      | `Decimal`  | montant misé                               |
| `price`       | `Decimal`  | prix du camp choisi au moment du pari (0 à 1) |
| `payout`      | `Decimal?` | `null` tant que le marché est ouvert, sinon montant reçu (0 si perdant) |
| `createdAt`   | `DateTime` |                                             |
| `userId`      | `String`   | FK vers `User`                             |
| `marketId`    | `String`   | FK vers `Market`                           |

### `PricePoint`

Historique du prix d'un marché, pour le graphe d'évolution du prix.

| Champ       | Type       | Notes                        |
| ----------- | ---------- | ------------------------------ |
| `id`          | `String`   | cuid                          |
| `yesPrice`    | `Decimal`  | prix du "oui" à cet instant   |
| `timestamp`   | `DateTime` |                               |
| `marketId`    | `String`   | FK vers `Market`               |

Un `PricePoint` est créé à chaque pari pour tracer la courbe.

## Routes

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /markets`, `GET /markets/:id` — public
- `GET /markets/:id/price-history` — public, liste des `PricePoint` triés par date (pour le graphe d'évolution). Un point à 0.5 est créé automatiquement à la création du marché.
- `POST /markets`, `PATCH /markets/:id`, `DELETE /markets/:id`, `POST /markets/:id/resolve` — admin
- `POST /bets` — placer un pari (utilisateur connecté). Débite le wallet, incrémente le pool du camp choisi + `totalVolume`, enregistre le prix obtenu sur le `Bet`, log un nouveau `PricePoint`.
- `GET /bets?status=ongoing|past` — historique des paris de l'utilisateur connecté, filtrable par marché en cours (`OPEN`) ou passé (`RESOLVED`)
- `GET /bets?all=true` — (admin) tous les paris, tous utilisateurs confondus
- `GET /bets/:id` — un pari (propriétaire ou admin)
- `DELETE /bets/:id` — (admin) annule un pari : rembourse le wallet, retire le montant du pool et du volume. Refusé si le marché est déjà résolu.
- `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` — (admin) CRUD utilisateurs. `DELETE` refusé si l'utilisateur a déjà des paris.
- `GET /users/:id` — soi-même ou admin

## Règlement des gains (settlement)

Quand un marché est conclu (`POST /markets/:id/resolve`), les gains sont réglés immédiatement dans la même transaction :

- Modèle pari-mutuel : les gagnants (camp = `outcome`) se partagent l'intégralité de l'argent réellement misé sur ce marché (`totalPool`, somme des `Bet.amount`, **pas** les pools virtuels de départ), proportionnellement à leur mise : `payout = (mise / poolGagnant) * poolTotal`.
- Si personne n'a parié sur le camp gagnant, tout le monde est remboursé (push).
- Chaque `Bet` reçoit son `payout` (0 pour un pari perdant, non-null dès que le marché est résolu).
- Un pari ne peut plus être annulé (`DELETE /bets/:id`) une fois le marché résolu, car les gains ont déjà été distribués.

## Diagramme

```
User ──< Bet >── Market ──< PricePoint
```

- Un `User` peut avoir plusieurs `Bet`.
- Un `Market` peut avoir plusieurs `Bet` et plusieurs `PricePoint`.
