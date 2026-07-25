# Discord bot — modération des propositions de marché

Bot Discord persistant (discord.js) qui sert d'interface de modération pour les marchés proposés par les
utilisateurs (voir [`apps/api/README.md`](../api/README.md) pour le modèle `MarketProposal` et les routes
`/market-proposals`). Il tourne comme service Docker dédié (`docker-compose.yml`, service `discord-bot`),
aux côtés de `postgres` et `hardhat`.

## Pourquoi un bot plutôt qu'un simple webhook

Un webhook Discord suffirait pour *notifier* d'une nouvelle proposition, mais pas pour agir (boutons
Approuver/Rejeter) : ça demande un vrai bot qui écoute les interactions. Choix fait en session : un bot
persistant (`discord.js`, connexion Gateway) plutôt qu'un simple endpoint HTTP d'interactions — pattern
plus classique/documenté, cohérent avec le fait que le projet a déjà plusieurs services Docker (Postgres,
Hardhat).

## Architecture : polling, pas de webhook entrant

Le bot n'a **aucun accès direct à Postgres** (Prisma reste centralisé dans `apps/api`) et n'expose aucun
port entrant. Il communique avec l'API uniquement en HTTP sortant, via un secret partagé
(`X-Internal-Secret` / `INTERNAL_API_SECRET`, voir `requireInternal`/`requireAdminOrInternal` côté API) :

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

## Sécurité : qui peut cliquer les boutons

La frontière de sécurité principale reste l'appartenance au serveur Discord (censé n'avoir que des
admins comme membres) — le secret partagé n'authentifie que le bot lui-même, pas la personne qui clique.
En complément (défense en profondeur, pas un remplacement) :

- `interactions.ts` vérifie `interaction.memberPermissions.has(PermissionFlagsBits.Administrator)` avant
  d'agir sur un clic Approuver/Rejeter, et répond en éphémère si la personne n'a pas la permission
  Administrateur sur le serveur — utile si jamais un compte non-admin se retrouve avec accès au salon.
- Le pseudo Discord de la personne qui a cliqué (`interaction.user.tag`) est transmis à l'API et stocké
  dans `MarketProposal.decidedBy` (`discord:<pseudo>` plutôt que le générique `"discord-bot"`) — pour
  savoir après coup qui a pris quelle décision, que ce soit depuis Discord ou depuis le site.

## Fichiers

- `src/env.ts` — lecture/validation des variables d'environnement.
- `src/apiClient.ts` — client HTTP vers l'API (toujours avec le header `X-Internal-Secret`).
- `src/embeds.ts` — construction des embeds/boutons Discord.
- `src/pollLoop.ts` — la boucle de polling décrite plus haut.
- `src/interactions.ts` — gestion des clics sur les boutons Approuver/Rejeter.
- `src/index.ts` — point d'entrée : login du client discord.js (intent `Guilds` uniquement — pas besoin de
  lire le contenu des messages), démarre le polling une fois connecté.

## Variables d'environnement

Définies dans le `.env` à la racine du repo (lues par `docker-compose.yml`, service `discord-bot`) :

| Variable | Rôle |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Token du bot (Discord Developer Portal). |
| `DISCORD_CHANNEL_ID` | Salon où poster les propositions. |
| `INTERNAL_API_SECRET` | Doit être **identique** à celui d'`apps/api/.env`. |
| `DISCORD_BOT_API_BASE_URL` | Base URL de l'API vue depuis le conteneur — `http://host.docker.internal:4000` par défaut, nécessaire car `apps/api` tourne nativement sur l'hôte (pas dans Docker), donc `localhost` depuis le conteneur pointerait sur le conteneur lui-même. |
| `POLL_INTERVAL_MS` | Intervalle de polling, 5000 par défaut. |

## Créer l'application Discord

1. https://discord.com/developers/applications → **New Application**.
2. Onglet **Bot** → **Reset Token** → copier dans `DISCORD_BOT_TOKEN`. **Privileged Gateway Intents** :
   tout désactivé (le bot ne lit pas le contenu des messages).
3. Onglet **OAuth2 → URL Generator** → scope `bot`, permissions `View Channel`, `Send Messages`,
   `Embed Links`, `Read Message History` → ouvrir l'URL générée, choisir le serveur admin-only, autoriser.
4. Dans Discord : activer le **mode développeur** (Paramètres → Avancés), clic droit sur le salon cible →
   **Copier l'ID du salon** → `DISCORD_CHANNEL_ID`.
5. Générer `INTERNAL_API_SECRET` (ex. `openssl rand -hex 32`), même valeur dans le `.env` racine et dans
   `apps/api/.env`.

## Lancer

Fait partie de `npm run dev` (service Docker démarré par `npm run dev:db:wait`, pas de script `dev:*`
dédié nécessaire au niveau racine — comme le service `hardhat`). En cas de token invalide/absent, le
conteneur plante et redémarre en boucle (`restart: unless-stopped`) sans affecter les autres services ;
`docker compose logs discord-bot` montre l'erreur exacte.

En dev local hors Docker : `npm run dev` (`tsx watch src/index.ts`) depuis `apps/discord-bot`, avec les
mêmes variables d'environnement disponibles (`.env` local ou export shell).
