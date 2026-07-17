# Web — Frontend

Next.js (App Router, TypeScript, Tailwind v4). Parle à l'API (`apps/api`) via `fetch`, aucune route API interne à ce projet — tout passe par `NEXT_PUBLIC_API_URL`.

## Configuration

`.env` (non versionné) :

```
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

## Authentification

JWT géré côté client (pas NextAuth) : `src/lib/auth-context.tsx` stocke le token dans `localStorage` et expose `useAuth()` (`user`, `token`, `login`, `register`, `logout`, `refreshUser`). `src/lib/api.ts` fournit `apiFetch()`, un wrapper `fetch` qui attache le header `Authorization: Bearer <token>` et traduit les messages d'erreur de l'API en français, et `errorMessage(err)`, à utiliser dans tous les `catch` pour obtenir ce message traduit de façon homogène (au lieu de réinventer le `instanceof ApiError ? ... : ...` à chaque formulaire).

Comme le token vit en `localStorage`, toute page qui a besoin de la session (portefeuille, formulaire de pari, admin) est un Client Component (`"use client"`) qui fetch côté client. Les pages publiques (accueil, liste des marchés, détail d'un marché) sont des Server Components qui fetchent directement l'API côté serveur.

## Structure des pages

```
src/app/
  page.tsx                     accueil : marché vedette + grille des marchés ouverts
  marches/page.tsx             liste des marchés, filtres catégorie/statut
  marches/[id]/page.tsx        détail d'un marché : description, cotes, graphe, formulaire de pari
  connexion/, inscription/     auth
  portefeuille/page.tsx        solde, adresse du wallet on-chain, historique des paris avec hash de transaction
  admin/                       réservé aux comptes role=ADMIN (garde côté client dans admin/layout.tsx)
    marches/                   CRUD marché + conclure un marché
    paris/                     liste de tous les paris (mise, camp, gain, hash de transaction)
    utilisateurs/              CRUD utilisateurs
```

## Composants notables

- `components/split-bar.tsx` — la barre de répartition OUI/NON (élément signature du design), réutilisée partout où une cote est affichée.
- `components/price-chart.tsx` — graphe d'évolution du prix en SVG fait main (pas de librairie de charts).
- `components/market-form.tsx` — formulaire partagé entre création et édition de marché côté admin.
- `lib/confirm-context.tsx` — remplace `window.confirm()` par une modale in-app (`useConfirm()`), utilisée pour toutes les actions destructives admin (conclure, supprimer, annuler).

## Design

Thème sombre, palette validée avec le skill dataviz (vert/rouge sémantiques pour OUI/NON). Typographie : Space Grotesk (titres), Inter (texte), JetBrains Mono (chiffres/cotes). Détails dans `src/app/globals.css`.

## Commandes

```bash
npm run dev     # serveur de dev (Turbopack)
npm run build   # build de production, valide aussi le typage TypeScript
npm run lint
```
