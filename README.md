# EpiMarket

Clone de Polymarket réalisé dans le cadre du projet pro Epitech : marchés de prédiction binaires (oui/non) ou à options multiples (3 à 6 issues), portefeuille (wallet on-chain), paris, et administration (CRUD marchés/paris/utilisateurs, conclusion d'un marché avec règlement des gains). Le solde et le règlement des gains passent par une vraie blockchain locale (Hardhat), pas par de simples colonnes Postgres.

Pour une prise en main pas à pas du site (compte, paris, portefeuille, espace admin), voir [`GUIDE_UTILISATEUR.md`](GUIDE_UTILISATEUR.md).

## Stack

- **Frontend** : Next.js (App Router, TypeScript, Tailwind) — `apps/web`
- **Backend** : Node.js / Express (TypeScript) — `apps/api`
- **Base de données** : PostgreSQL, via Prisma ORM (miroir de l'état on-chain, pas la source de vérité pour l'argent)
- **Blockchain** : Hardhat (réseau Ethereum local) + contrat `EpiMarket` en Solidity — `apps/blockchain`
- **Monorepo** : npm workspaces

## Prérequis

- Node.js 20+
- Docker (pour PostgreSQL et le nœud Hardhat)

## Installation

```bash
npm install
```

Puis créer quatre fichiers `.env` (non versionnés) avec les variables suivantes :

**`.env`** (racine — identifiants PostgreSQL utilisés par Docker Compose) :

```
POSTGRES_USER=polymarket
POSTGRES_PASSWORD=polymarket
POSTGRES_DB=polymarket
POSTGRES_PORT=5432
```

**`apps/api/.env`** :

```
DATABASE_URL="postgresql://polymarket:polymarket@localhost:5432/polymarket"
PORT=4000
JWT_SECRET="change-me-in-production"
FRONTEND_URL="http://localhost:3000"
WALLET_ENCRYPTION_KEY="<32 octets aléatoires en hexadécimal>"
HARDHAT_RPC_URL="http://127.0.0.1:8545"
HARDHAT_FUNDER_PRIVATE_KEY="<clé privée du compte owner du contrat>"
```

**`apps/web/.env`** :

```
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Voir [`apps/api/README.md`](apps/api/README.md) pour le détail du schéma de base de données et de l'intégration blockchain, [`apps/web/README.md`](apps/web/README.md) pour la structure du frontend, et [`apps/blockchain/README.md`](apps/blockchain/README.md) pour le contrat.

## Lancer le projet en développement

```bash
npm run dev
```

Cela démarre PostgreSQL et le nœud Hardhat (Docker), l'API (`http://localhost:4000`) et le frontend (`http://localhost:3000`) en parallèle. Le contrat `EpiMarket` est déployé automatiquement au démarrage du service `hardhat`.

Vous pouvez aussi lancer chaque service séparément :

```bash
npm run dev:db    # PostgreSQL + Hardhat via Docker
npm run dev:api   # API Express
npm run dev:web   # Next.js
```

Pour tout arrêter proprement (processus API/Web + conteneurs Docker) :

```bash
npm run stop
```

Ou pour tout arrêter puis relancer en une seule commande :

```bash
npm run restart
```

Au premier lancement, appliquez les migrations et créez un compte admin de test :

```bash
cd apps/api
npx prisma migrate dev
npm run db:seed   # crée admin@epitech.eu / admin1234
```

Sur Windows, `npm run dev` lance aussi un script (`scripts/fix-wsl-docker-offload.ps1`) qui vérifie et corrige automatiquement un bug réseau connu de WSL2/Docker Desktop (voir le script pour le détail) — sans effet sur les autres plateformes. Il redémarre aussi systématiquement le conteneur `postgres` après le `docker compose up -d` (`dev:db:wait`) : après un cycle WSL2, Docker peut afficher le conteneur comme `Running` alors que le port-forward réseau vers `localhost:5432` est resté cassé — un simple restart le rétablit.

`npm run stop`/`npm run restart` reposent eux aussi sur un script PowerShell (`scripts/stop-dev.ps1`), spécifique à Windows.

## Fonctionnalités

**Côté utilisateur** : inscription/connexion, portefeuille (wallet on-chain, 1000 tokens de départ), parcourir les marchés (filtres catégorie/statut), placer un pari (oui/non ou l'une de 3 à 6 options selon le marché, vraie transaction on-chain), historique des paris avec hash de transaction (en cours / passés), graphe d'évolution du prix, mode clair/sombre. La page d'accueil affiche un carousel de statistiques globales (marchés ouverts, volume, paris actifs, parieurs) sous forme de courbes navigables dans le temps. La page **Profil** (ex-Portefeuille) ajoute des statistiques personnelles : taux de réussite, gains/pertes nets, répartition par catégorie, courbe de gains/pertes cumulés. Une page **Classement** (publique, pas besoin d'être connecté) affiche les meilleurs parieurs classés par gain net réalisé. Une page **Support** permet de signaler un problème (ex. un pari qui n'apparaît pas) en créant un ticket, pré-rempli automatiquement avec le hash de transaction si l'erreur en fournit un.

**Côté admin** (`/admin`, compte avec `role: ADMIN`) : CRUD marché — binaire (oui/non) ou à options multiples (3 à 6, ex. "qui remporte le tournoi ?") — (créer/éditer/supprimer — un marché résolu ne peut plus être ni édité ni supprimé), conclure un marché (règle les gains automatiquement via le contrat, et peut être rappelé pour rattraper une synchronisation qui aurait échoué), liste des paris, CRUD utilisateurs, gestion des tickets de support (changer le statut, répondre), et un tableau de bord **Diagnostics** qui détecte automatiquement les désynchronisations entre la base et la blockchain (marché absent on-chain, pari résolu sans gain calculé, solde utilisateur qui a dérivé) avec une action de correction en un clic pour chacune. Un admin n'a pas de portefeuille et ne peut pas parier (il peut créer/résoudre les marchés, donc pas parier dessus sans conflit d'intérêt).

## Structure

```
apps/
  api/         # Backend Express + Prisma — voir apps/api/README.md
  web/         # Frontend Next.js — voir apps/web/README.md
  blockchain/  # Contrat Hardhat/Solidity — voir apps/blockchain/README.md
docker-compose.yml   # PostgreSQL + nœud Hardhat local
```
