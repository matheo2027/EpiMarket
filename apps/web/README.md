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

## Internationalisation (FR/EN/ES/DE)

`src/lib/i18n/` contient un dictionnaire par langue (`fr.ts` canonique — définit le type `TranslationKey`
— puis `en.ts`/`es.ts`/`de.ts`, chacun typé `Record<TranslationKey, string>` : impossible de merger une
traduction incomplète, TypeScript refuse de compiler si une clé manque ou est en trop dans l'une des
quatre langues). `src/lib/language-context.tsx` (`LanguageProvider`/`useLanguage()`) suit le même
patron que `theme-context.tsx` — persisté dans `localStorage` (`epimarket-language`), démarre à `"fr"`
côté serveur pour éviter un mismatch d'hydratation, corrigé après montage.

`useLanguage()` expose `t(key, vars?)` (interpolation `{nom}` dans les chaînes) et `tp(key, count, vars?)`
qui choisit `${key}.one`/`${key}.other` selon `count` (pluriel façon anglais : singulier seulement à
exactement 1). `src/lib/i18n/index.ts` fournit aussi `categoryKey()`/`ticketStatusKey()` (mappent les
enums Prisma vers une clé de traduction) et `localeFor(language)` (code BCP-47 pour `toLocaleDateString`).

Les messages d'erreur renvoyés par l'API sont toujours en anglais (voir `apps/api`) ; `errorMessage(err, t)`
dans `lib/api.ts` les fait correspondre à une clé `errors.*` via `apiErrorKey()` avant de les traduire — un
message backend inconnu de la table retombe sur l'anglais brut plutôt que de planter.

**Portée volontairement limitée à l'espace public/utilisateur** : l'espace admin (`app/admin/**`,
`components/market-form.tsx`) reste **en français uniquement**, jamais vu par un visiteur externe ou le
jury. Ses appels à `errorMessage()` passent `frT` (un raccourci `(key) => translate("fr", key)` exporté
par `lib/i18n/index.ts`) plutôt qu'un vrai `t()` issu de `useLanguage()`.

**Pourquoi certaines pages publiques ont un composant `*-content.tsx` séparé** : `page.tsx` (accueil),
`marches/page.tsx`, `marches/[id]/page.tsx` et `classement/page.tsx` restent des Server Components qui
fetchent côté serveur (pas de changement d'architecture pour l'i18n) — mais le texte affiché doit réagir
au changement de langue en direct, ce qui demande `useLanguage()`, un hook client. Chacune délègue donc
son rendu à un Client Component homonyme (`components/home-content.tsx`, `marches-content.tsx`,
`market-detail-content.tsx`, `classement-content.tsx`) qui reçoit les données déjà fetchées en props.

`components/language-switcher.tsx` (`variant="compact"` dans le header, `variant="full"` dans le pied de
page) est le seul endroit qui appelle `setLanguage()`.

## Structure des pages

```
src/app/
  page.tsx                     accueil : carousel de stats globales + marché vedette + grille des marchés ouverts
  marches/page.tsx             liste des marchés, filtres catégorie/statut
  marches/[id]/page.tsx        détail d'un marché : description, cotes, graphe, formulaire de pari
                                (deux mises en page selon market.type — OUI/NON ou options multiples),
                                et sous le formulaire une section « Vos paris sur ce marché » (bouton
                                Retirer, mêmes règles que sur la page Profil)
  classement/page.tsx          classement public des meilleurs parieurs (gain net réalisé), Server
                                Component comme marches/page.tsx — pas besoin d'être connecté
  connexion/, inscription/     auth
  mot-de-passe-oublie/,        réinitialisation de mot de passe — pas d'infra email dans ce POC, le lien
  reinitialiser-mot-de-passe/  de reset est affiché directement au lieu d'être envoyé par email
  portefeuille/page.tsx        page "Profil" : solde, wallet on-chain, stats (taux de réussite, P&L,
                                répartition par catégorie, courbe de gains/pertes), historique des paris
                                (avec bouton "Retirer" sur un pari en cours — remboursement intégral
                                avant résolution, pas une vente au prix du marché)
  support/page.tsx             signaler un problème (ticket) + suivi de ses propres tickets
  admin/                       réservé aux comptes role=ADMIN (garde côté client dans admin/layout.tsx)
    marches/                   CRUD marché + conclure un marché
    paris/                     liste de tous les paris (mise, camp, gain, hash de transaction)
    utilisateurs/              CRUD utilisateurs
    tickets/                   traiter les tickets de support (statut, note)
    diagnostics/               cohérence base ↔ blockchain, avec actions de resynchronisation
```

## Composants notables

- `components/split-bar.tsx` — la barre de répartition OUI/NON pour un marché `BINARY`, réutilisée partout où une cote est affichée.
- `components/options-bar.tsx` — l'équivalent pour un marché `MULTI` : une ligne par option (libellé + barre + %), triée par ordre de création. `compact` limite l'affichage aux 4 premières (cartes de marché).
- `components/price-chart.tsx`, `components/options-price-chart.tsx`, `components/pnl-chart.tsx`, `components/stat-chart.tsx` — graphes en SVG fait main (pas de librairie de charts), partagent le même langage visuel (aire dégradée, ligne avec glow). `price-chart.tsx` trace les deux courbes OUI/NON (miroir l'une de l'autre) ; `options-price-chart.tsx` trace une courbe par option (jusqu'à 6, `lib/option-tones.ts`) avec une légende au lieu d'une grosse valeur unique. Tous se pilotent à la souris (survol = déplacement dans le temps, sans clic) ou via les flèches en bas du graphe (clic maintenu = défilement continu, `lib/use-hold-repeat.ts`).
- `lib/option-tones.ts` — palette catégorielle fixe (brand/yes/series-3..6) partagée par `options-bar.tsx` et `options-price-chart.tsx`, pour qu'une option garde toujours la même couleur aux deux endroits.
- `components/stat-carousel.tsx` — carousel glissable (souris ou tactile) entre les 4 statistiques de l'accueil, chacune dans sa propre couleur (palette catégorielle validée avec le skill dataviz).
- `components/animated-number.tsx` — anime un nombre affiché d'une valeur à l'autre (count-up), utilisé pour tous les gros chiffres (KPI, stats de profil).
- `components/theme-toggle.tsx` + `lib/theme-context.tsx` — bascule clair/sombre, sans flash au chargement (script inline dans `layout.tsx` qui pose `data-theme` avant l'hydratation).
- `components/language-switcher.tsx` + `lib/language-context.tsx` — sélecteur FR/EN/ES/DE, voir la section Internationalisation plus haut.
- `components/footer.tsx` — pied de page (catégories de marchés, liens réels du site, lien vers le dépôt GitHub, mention légale/pédagogique, sélecteur de langue) rendu dans `layout.tsx` sur toutes les pages, y compris admin.
- `components/market-form.tsx` — formulaire partagé entre création et édition de marché côté admin. Le type (`BINARY`/`MULTI`) ne se choisit qu'à la création ; pour `MULTI`, une liste dynamique de libellés d'options (3 à 6) remplace les champs OUI/NON, et le nombre d'options est verrouillé une fois le marché créé (fixé on-chain). À la création, un 4ᵉ slot par défaut est pré-rempli avec "Autre" (aucun traitement spécial ailleurs dans le code — c'est une option comme les autres, le règlement pari-mutuel ne distingue pas son `optionId`) ; `addOption()` insère les nouveaux slots juste avant elle pour qu'elle reste toujours en dernière position.
- `components/admin-stats.tsx` — bandeau de compteurs globaux en haut des pages admin (`GET /users/stats`).
- `lib/bet-stats.ts` — calcule les statistiques de la page Profil (taux de réussite, P&L, répartition par catégorie, historique) à partir de la liste brute des paris de l'utilisateur.
- `components/bet-row.tsx` — une ligne de pari (mise, statut/gain, bouton Retirer si `canWithdraw()` — même règle de 5h que côté API), partagée entre `portefeuille/page.tsx` et `components/market-bets.tsx` pour ne pas dupliquer la logique de retrait. `linkToMarket` désactive le lien vers le marché (inutile quand on est déjà dessus).
- `components/market-bets.tsx` — section « Vos paris sur ce marché » sous le formulaire de pari (`marches/[id]`), fetch `GET /bets?marketId=`, masquée si non connecté ou admin. Un retrait déclenche `router.refresh()` pour que les cotes affichées (pool impacté par le remboursement) se remettent à jour.
- `lib/confirm-context.tsx` — remplace `window.confirm()` par une modale in-app (`useConfirm()`), utilisée pour toutes les actions destructives ou déclenchant une vraie transaction blockchain (conclure, supprimer, resynchroniser).
- `app/admin/diagnostics/page.tsx` — si `GET /diagnostics` renvoie `503` (blockchain locale pas encore joignable, typiquement juste après `npm run dev`), la page affiche un message d'attente et réessaie automatiquement toutes les 3s (jusqu'à 10 fois) au lieu d'afficher une erreur ; au-delà, un bouton "Réessayer" manuel apparaît.

## Design

Direction "Glass Terminal" : fond très sombre (ou clair en mode jour), cartes en verre dépoli (`backdrop-filter: blur`), accent bleu électrique, vert/rouge sémantiques pour OUI/NON, palette catégorielle (bleu/vert/rose/ambre) pour distinguer les statistiques entre elles — palette validée avec le skill dataviz (contraste et distinction daltonisme vérifiés, pas choisie à l'œil). Typographie : Geist (titres/texte), Geist Mono (chiffres/cotes). Bascule clair/sombre disponible dans le header. Détails dans `src/app/globals.css`.

## Commandes

```bash
npm run dev     # serveur de dev (Turbopack)
npm run build   # build de production, valide aussi le typage TypeScript
npm run lint
```
