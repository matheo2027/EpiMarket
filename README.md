# Epitech Polymarket

Clone de Polymarket réalisé dans le cadre du projet pro Epitech : marchés de prédiction binaires (oui/non), portefeuille virtuel, paris, et administration (CRUD marchés/paris/utilisateurs, conclusion d'un marché avec règlement des gains).

## Stack

- **Frontend** : Next.js (App Router, TypeScript, Tailwind) — `apps/web`
- **Backend** : Node.js / Express (TypeScript) — `apps/api`
- **Base de données** : PostgreSQL, via Prisma ORM
- **Monorepo** : npm workspaces

## Prérequis

- Node.js 20+
- Docker (pour PostgreSQL)

## Installation

```bash
npm install
```

Puis créer trois fichiers `.env` (non versionnés) avec les variables suivantes :

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
```

**`apps/web/.env`** :

```
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Voir [`apps/api/README.md`](apps/api/README.md) pour le détail du schéma de base de données et [`apps/web/README.md`](apps/web/README.md) pour la structure du frontend.

## Lancer le projet en développement

```bash
npm run dev
```

Cela démarre PostgreSQL (Docker), l'API (`http://localhost:4000`) et le frontend (`http://localhost:3000`) en parallèle.

Vous pouvez aussi lancer chaque service séparément :

```bash
npm run dev:db    # PostgreSQL via Docker
npm run dev:api   # API Express
npm run dev:web   # Next.js
```

Au premier lancement, appliquez les migrations et créez un compte admin de test :

```bash
cd apps/api
npx prisma migrate dev
npm run db:seed   # crée admin@epitech.eu / admin1234
```

## Fonctionnalités

**Côté utilisateur** : inscription/connexion, portefeuille virtuel (1000 € de départ), parcourir les marchés (filtres catégorie/statut), placer un pari (oui/non), historique des paris (en cours / passés), graphe d'évolution du prix.

**Côté admin** (`/admin`, compte avec `role: ADMIN`) : CRUD marché (créer/éditer/supprimer), conclure un marché (règle les gains automatiquement), liste et annulation des paris, CRUD utilisateurs.

## Structure

```
apps/
  api/    # Backend Express + Prisma — voir apps/api/README.md
  web/    # Frontend Next.js — voir apps/web/README.md
docker-compose.yml   # PostgreSQL local
```
