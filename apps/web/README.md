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
  page.tsx                     accueil : carousel de stats globales + marché vedette + grille des marchés ouverts
  marches/page.tsx             liste des marchés, filtres catégorie/statut
  marches/[id]/page.tsx        détail d'un marché : description, cotes, graphe, formulaire de pari
  connexion/, inscription/     auth
  portefeuille/page.tsx        page "Profil" : solde, wallet on-chain, stats (taux de réussite, P&L,
                                répartition par catégorie, courbe de gains/pertes), historique des paris
  support/page.tsx             signaler un problème (ticket) + suivi de ses propres tickets
  admin/                       réservé aux comptes role=ADMIN (garde côté client dans admin/layout.tsx)
    marches/                   CRUD marché + conclure un marché
    paris/                     liste de tous les paris (mise, camp, gain, hash de transaction)
    utilisateurs/              CRUD utilisateurs
    tickets/                   traiter les tickets de support (statut, note)
    diagnostics/               cohérence base ↔ blockchain, avec actions de resynchronisation
```

## Composants notables

- `components/split-bar.tsx` — la barre de répartition OUI/NON, réutilisée partout où une cote est affichée.
- `components/price-chart.tsx`, `components/pnl-chart.tsx`, `components/stat-chart.tsx` — graphes en SVG fait main (pas de librairie de charts), partagent le même langage visuel (aire dégradée, ligne avec glow). `stat-chart.tsx` et `pnl-chart.tsx` se pilotent à la souris (survol = déplacement dans le temps, sans clic) ou via les flèches en bas du graphe (clic maintenu = défilement continu, `lib/use-hold-repeat.ts`).
- `components/stat-carousel.tsx` — carousel glissable (souris ou tactile) entre les 4 statistiques de l'accueil, chacune dans sa propre couleur (palette catégorielle validée avec le skill dataviz).
- `components/animated-number.tsx` — anime un nombre affiché d'une valeur à l'autre (count-up), utilisé pour tous les gros chiffres (KPI, stats de profil).
- `components/theme-toggle.tsx` + `lib/theme-context.tsx` — bascule clair/sombre, sans flash au chargement (script inline dans `layout.tsx` qui pose `data-theme` avant l'hydratation).
- `components/market-form.tsx` — formulaire partagé entre création et édition de marché côté admin.
- `components/admin-stats.tsx` — bandeau de compteurs globaux en haut des pages admin (`GET /users/stats`).
- `lib/bet-stats.ts` — calcule les statistiques de la page Profil (taux de réussite, P&L, répartition par catégorie, historique) à partir de la liste brute des paris de l'utilisateur.
- `lib/confirm-context.tsx` — remplace `window.confirm()` par une modale in-app (`useConfirm()`), utilisée pour toutes les actions destructives ou déclenchant une vraie transaction blockchain (conclure, supprimer, resynchroniser).

## Design

Direction "Glass Terminal" : fond très sombre (ou clair en mode jour), cartes en verre dépoli (`backdrop-filter: blur`), accent bleu électrique, vert/rouge sémantiques pour OUI/NON, palette catégorielle (bleu/vert/rose/ambre) pour distinguer les statistiques entre elles — palette validée avec le skill dataviz (contraste et distinction daltonisme vérifiés, pas choisie à l'œil). Typographie : Geist (titres/texte), Geist Mono (chiffres/cotes). Bascule clair/sombre disponible dans le header. Détails dans `src/app/globals.css`.

## Commandes

```bash
npm run dev     # serveur de dev (Turbopack)
npm run build   # build de production, valide aussi le typage TypeScript
npm run lint
```
