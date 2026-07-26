# Discord bots

Ce package contient **trois bots Discord** indépendants, sur le même serveur (admin-only) mais chacun
dans son propre salon :

- **Bot de modération** (`src/index.ts` et alentours) — poste chaque marché proposé par un utilisateur
  avec des boutons Approuver/Rejeter. Voir [Bot de modération des propositions](#bot-de-modération-des-propositions-de-marché).
- **Bot paris** (`src/bets-bot/`) — annonce chaque pari placé ou retiré (utilisateur, mise, marché),
  purement informatif, aucune action possible depuis Discord. Voir [Bot paris](#bot-paris).
- **Bot résolutions** (`src/resolutions-bot/`) — annonce chaque marché conclu (titre, issue gagnante),
  purement informatif lui aussi. Voir [Bot résolutions](#bot-résolutions).

Les trois tournent comme services Docker séparés (`discord-bot`, `bets-bot` et `resolutions-bot` dans
`docker-compose.yml`), avec trois applications/tokens Discord distincts (permissions minimales : chaque
bot n'a besoin d'accès qu'à son propre salon). Ils partagent le code HTTP bas niveau
(`src/httpClient.ts`), mais **pas** le secret interne : chacun a le sien
(`INTERNAL_API_SECRET_MODERATION` / `INTERNAL_API_SECRET_BETS` / `INTERNAL_API_SECRET_RESOLUTIONS`), voir
[Sécurité : qui peut cliquer les boutons](#sécurité--qui-peut-cliquer-les-boutons) plus bas.

## Bot de modération des propositions de marché

Interface de modération pour les marchés proposés par les utilisateurs (voir
[`apps/api/README.md`](../api/README.md) pour le modèle `MarketProposal` et les routes
`/market-proposals`).

### Pourquoi un bot plutôt qu'un simple webhook

Un webhook Discord suffirait pour *notifier* d'une nouvelle proposition, mais pas pour agir (boutons
Approuver/Rejeter) : ça demande un vrai bot qui écoute les interactions. Choix fait en session : un bot
persistant (`discord.js`, connexion Gateway) plutôt qu'un simple endpoint HTTP d'interactions — pattern
plus classique/documenté, cohérent avec le fait que le projet a déjà plusieurs services Docker (Postgres,
Hardhat).

### Architecture : polling, pas de webhook entrant

Le bot n'a **aucun accès direct à Postgres** (Prisma reste centralisé dans `apps/api`) et n'expose aucun
port entrant. Il communique avec l'API uniquement en HTTP sortant, via un secret propre à ce bot
(`X-Internal-Secret` / `INTERNAL_API_SECRET_MODERATION`, voir `requireInternalSecret`/
`requireAdminOrInternalSecret` côté API) :

- **Nouvelles propositions → Discord** : `pollLoop.ts` interroge `GET /market-proposals/pending-unnotified`
  toutes les `POLL_INTERVAL_MS` (5s par défaut), poste un embed avec deux boutons (`approve:<id>` /
  `reject:<id>`) dans `DISCORD_CHANNEL_ID`, puis appelle `PATCH /market-proposals/:id/notify` pour que
  l'API n'en propose plus deux fois.
- **Décision prise sur Discord** (clic sur un bouton) → `interactions.ts` appelle
  `POST /market-proposals/:id/approve` ou `/reject`, édite immédiatement le message (embed vert/rouge,
  boutons retirés), puis appelle `PATCH /market-proposals/:id/sync`.
- **Décision prise sur le site** (onglet admin `/admin/propositions`) → le bot ne le sait pas tout de
  suite : le même `pollLoop.ts` interroge aussi `GET /market-proposals/decided-unsynced` et édite le
  message Discord correspondant a posteriori, puis marque la proposition synchronisée.

Ce choix (polling dans les deux sens plutôt qu'un push de l'API vers le bot) évite d'ouvrir un port entrant
sur le conteneur du bot — l'API n'a donc jamais besoin de connaître l'adresse du bot, seulement l'inverse.
Les deux surfaces de décision (Discord et le site) appellent la **même** route d'approbation/rejet côté
API, qui est idempotente : approuver une proposition déjà décidée renvoie le résultat existant au lieu de
planter ou de créer un second marché — nécessaire puisque les deux clics peuvent arriver en même temps.

### Sécurité : qui peut cliquer les boutons

La frontière de sécurité principale reste l'appartenance au serveur Discord (censé n'avoir que des
admins comme membres) — le secret interne n'authentifie que le bot lui-même, pas la personne qui clique.
En complément (défense en profondeur, pas un remplacement) :

- `interactions.ts` vérifie `interaction.memberPermissions.has(PermissionFlagsBits.Administrator)` avant
  d'agir sur un clic Approuver/Rejeter, et répond en éphémère si la personne n'a pas la permission
  Administrateur sur le serveur — utile si jamais un compte non-admin se retrouve avec accès au salon.
- Le pseudo Discord de la personne qui a cliqué (`interaction.user.tag`) est transmis à l'API et stocké
  dans `MarketProposal.decidedBy` (`discord:<pseudo>` plutôt que le générique `"discord-bot"`) — pour
  savoir après coup qui a pris quelle décision, que ce soit depuis Discord ou depuis le site.
- **Secret interne propre à ce bot** (`INTERNAL_API_SECRET_MODERATION`, distinct de celui du bot paris) :
  `requireInternalSecret`/`requireAdminOrInternalSecret` côté API (`apps/api/src/middleware/auth.ts`)
  prennent le nom de la variable à vérifier en paramètre plutôt qu'un secret global unique — si ce bot
  est un jour compromis, le secret volé ne débloque que les routes `/market-proposals/*`, pas
  `/bets/*`.

### Fichiers

- `src/env.ts` — lecture/validation des variables d'environnement.
- `src/apiClient.ts` — client HTTP vers l'API (types + endpoints `/market-proposals/*`).
- `src/embeds.ts` — construction des embeds/boutons Discord.
- `src/pollLoop.ts` — la boucle de polling décrite plus haut.
- `src/interactions.ts` — gestion des clics sur les boutons Approuver/Rejeter.
- `src/index.ts` — point d'entrée : login du client discord.js (intent `Guilds` uniquement — pas besoin de
  lire le contenu des messages), démarre le polling une fois connecté.

## Bot paris

Annonce en lecture seule dans un salon dédié : chaque pari **placé** ou **retiré** génère un message avec
l'utilisateur, la mise et le marché concerné (plus l'option ou le camp OUI/NON). Aucune action admin
possible depuis Discord pour ce bot — c'est un simple flux d'activité, pas un outil de modération.

Même principe de polling que le bot de modération, mais à sens unique (pas de décision à faire remonter) :

- `pollLoop.ts` interroge `GET /bets/unnotified` (`apps/api/src/routes/bets.ts`), qui renvoie séparément
  les paris **placés** pas encore annoncés (`discordNotifiedAt IS NULL`) et les paris **retirés** pas
  encore annoncés (`discordWithdrawNotifiedAt IS NULL`) — un pari peut avoir besoin des deux annonces à
  des moments différents.
- Pour chacun, poste l'embed correspondant (`embeds.ts`) dans `BETS_DISCORD_CHANNEL_ID`, puis appelle
  `PATCH /bets/:id/notify` avec `{ event: "placed" | "withdrawn" }` pour ne jamais l'annoncer deux fois.
- Aucun `interactions.ts` : pas de bouton, donc pas de client à faire écouter les interactions Discord.

### Fichiers

- `src/bets-bot/env.ts` — variables d'environnement propres à ce bot (`BETS_DISCORD_BOT_TOKEN`,
  `BETS_DISCORD_CHANNEL_ID`, `INTERNAL_API_SECRET_BETS` — ce dernier distinct de celui du bot de
  modération, voir la section Sécurité plus haut) + celles partagées (`API_BASE_URL`, `POLL_INTERVAL_MS`).
- `src/bets-bot/apiClient.ts` — client HTTP vers `/bets/unnotified` et `/bets/:id/notify`.
- `src/bets-bot/embeds.ts` — embed "pari placé" / "pari retiré".
- `src/bets-bot/pollLoop.ts` — la boucle de polling.
- `src/bets-bot/index.ts` — point d'entrée (même structure que `src/index.ts`, sans `interactions.ts`).
- `src/httpClient.ts` — partagé entre les trois bots : le fetch wrapper générique (`X-Internal-Secret`,
  gestion d'erreur), pour ne pas dupliquer ce bout de code entre les trois `apiClient.ts`.

## Bot résolutions

Annonce en lecture seule dans un salon dédié : chaque marché **conclu** (`POST /markets/:id/resolve`
côté API) génère un message avec le titre du marché et l'issue gagnante (OUI/NON, ou le libellé de
l'option pour un marché `MULTI`). Aucune action admin possible depuis Discord — même principe que le bot
paris, purement informatif.

Ajouté après coup, en généralisant le mécanisme "notifié ou pas" en une table `DiscordNotification`
(`apps/api/prisma/schema.prisma`) plutôt qu'une 3ᵉ paire de colonnes codées en dur — ce 3ᵉ évènement
porte sur `Market`, pas sur `Bet` comme les deux premiers, ce qui aurait obligé à dupliquer le même
pattern sur un second modèle. Voir `apps/api/README.md#discordnotification`.

Même principe de polling que les deux autres bots, à sens unique (pas de décision à faire remonter) :

- `pollLoop.ts` interroge `GET /markets/unnotified-resolutions` (`apps/api/src/routes/markets.ts`), qui
  renvoie les marchés résolus dont la `DiscordNotification` (`eventType: MARKET_RESOLVED`) n'a pas encore
  `notifiedAt` posé.
- Pour chacun, poste l'embed correspondant (`embeds.ts`) dans `RESOLUTIONS_DISCORD_CHANNEL_ID`, puis
  appelle `PATCH /markets/:id/notify-resolution` pour ne jamais l'annoncer deux fois.
- Aucun `interactions.ts` : pas de bouton, donc pas de client à faire écouter les interactions Discord.

### Fichiers

- `src/resolutions-bot/env.ts` — variables d'environnement propres à ce bot
  (`RESOLUTIONS_DISCORD_BOT_TOKEN`, `RESOLUTIONS_DISCORD_CHANNEL_ID`, `INTERNAL_API_SECRET_RESOLUTIONS`)
  + celles partagées (`API_BASE_URL`, `POLL_INTERVAL_MS`).
- `src/resolutions-bot/apiClient.ts` — client HTTP vers `/markets/unnotified-resolutions` et
  `/markets/:id/notify-resolution`.
- `src/resolutions-bot/embeds.ts` — embed "marché conclu".
- `src/resolutions-bot/pollLoop.ts` — la boucle de polling.
- `src/resolutions-bot/index.ts` — point d'entrée (même structure que `src/bets-bot/index.ts`).

## Variables d'environnement

Définies dans le `.env` à la racine du repo (lues par `docker-compose.yml`, services `discord-bot` et
`bets-bot`) :

| Variable | Bot | Rôle |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | Modération | Token du bot (Discord Developer Portal). |
| `DISCORD_CHANNEL_ID` | Modération | Salon où poster les propositions. |
| `BETS_DISCORD_BOT_TOKEN` | Paris | Token du bot paris — **application Discord séparée**, voir plus bas. |
| `BETS_DISCORD_CHANNEL_ID` | Paris | Salon où annoncer les paris. |
| `RESOLUTIONS_DISCORD_BOT_TOKEN` | Résolutions | Token du bot résolutions — **application Discord séparée**, voir plus bas. |
| `RESOLUTIONS_DISCORD_CHANNEL_ID` | Résolutions | Salon où annoncer les résolutions de marché. |
| `INTERNAL_API_SECRET_MODERATION` | Modération | Doit correspondre à la valeur du même nom dans `apps/api/.env`. **Propre à ce bot** — pas celui des deux autres. |
| `INTERNAL_API_SECRET_BETS` | Paris | Doit correspondre à la valeur du même nom dans `apps/api/.env`. **Propre à ce bot** — pas celui des deux autres. |
| `INTERNAL_API_SECRET_RESOLUTIONS` | Résolutions | Doit correspondre à la valeur du même nom dans `apps/api/.env`. **Propre à ce bot** — pas celui des deux autres. |
| `DISCORD_BOT_API_BASE_URL` | Les trois | Base URL de l'API vue depuis les conteneurs — `http://host.docker.internal:4000` par défaut, nécessaire car `apps/api` tourne nativement sur l'hôte (pas dans Docker), donc `localhost` depuis un conteneur pointerait sur le conteneur lui-même. |
| `POLL_INTERVAL_MS` | Les trois | Intervalle de polling, 5000 par défaut. |

## Créer les applications Discord

Répéter cette checklist **trois fois** (une par bot) — chaque bot est une application Discord distincte,
avec son propre token, invitée uniquement sur son propre salon (moindre privilège : le bot paris n'a pas
besoin de voir le salon de modération, ni celui de résolutions, et inversement) :

1. https://discord.com/developers/applications → **New Application**.
2. Onglet **Bot** → **Reset Token** → copier dans `DISCORD_BOT_TOKEN` (modération),
   `BETS_DISCORD_BOT_TOKEN` (paris) ou `RESOLUTIONS_DISCORD_BOT_TOKEN` (résolutions). **Privileged
   Gateway Intents** : tout désactivé (aucun des trois bots ne lit le contenu des messages).
3. Onglet **OAuth2 → URL Generator** → scope `bot`, permissions `View Channel`, `Send Messages`,
   `Embed Links`, `Read Message History` → ouvrir l'URL générée, choisir le serveur admin-only, autoriser.
   Une fois invité, restreindre l'accès du bot au salon voulu uniquement (permissions du salon dans
   Discord) si le serveur a d'autres salons.
4. Dans Discord : activer le **mode développeur** (Paramètres → Avancés), clic droit sur le salon cible →
   **Copier l'ID du salon** → `DISCORD_CHANNEL_ID`, `BETS_DISCORD_CHANNEL_ID` ou
   `RESOLUTIONS_DISCORD_CHANNEL_ID` selon le bot.
5. Générer **trois** secrets internes distincts (ex. `openssl rand -hex 32` trois fois) — un
   `INTERNAL_API_SECRET_MODERATION`, un `INTERNAL_API_SECRET_BETS` et un
   `INTERNAL_API_SECRET_RESOLUTIONS`, chacun mis à la même valeur dans le `.env` racine et dans
   `apps/api/.env`. Volontairement pas partagés : un secret compromis ne débloque que les routes de son
   propre bot (voir la section Sécurité plus haut).

## Lancer

Les trois bots font partie de `npm run dev` (services Docker démarrés par `npm run dev:db:wait`, pas de
script `dev:*` dédié nécessaire au niveau racine — comme le service `hardhat`). En cas de token
invalide/absent pour l'un des trois, son conteneur plante et redémarre en boucle
(`restart: unless-stopped`) **sans affecter les autres bots ni le reste des services** ;
`docker compose logs discord-bot`, `docker compose logs bets-bot` ou `docker compose logs resolutions-bot`
montre l'erreur exacte.

En dev local hors Docker, depuis `apps/discord-bot` :

```bash
npm run dev              # bot de modération (tsx watch src/index.ts)
npm run dev:bets          # bot paris (tsx watch src/bets-bot/index.ts)
npm run dev:resolutions   # bot résolutions (tsx watch src/resolutions-bot/index.ts)
```

avec les mêmes variables d'environnement disponibles (`.env` local ou export shell).
