# Epitech Polymarket

Clone de Polymarket réalisé dans le cadre du projet pro Epitech.

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
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

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

La page d'accueil (`http://localhost:3000`) affiche l'état de santé de l'API et sa connexion à la base de données.

## Structure

```
apps/
  api/    # Backend Express + Prisma
  web/    # Frontend Next.js
docker-compose.yml   # PostgreSQL local
```
