# Blockchain — POC Hardhat

Chaîne Ethereum locale (Hardhat) qui remplace le solde/l'historique de paris purement Postgres par de
vraies transactions on-chain. Voir [`apps/api/README.md`](../api/README.md#intégration-blockchain-poc-hardhat)
pour la partie backend (wallets custodiaux, appels au contrat).

## Le contrat `EpiMarket`

`contracts/EpiMarket.sol` est à la fois le token ERC-20 (le solde des utilisateurs) et la logique de
paris/règlement d'un marché de prédiction. Un seul contrat plutôt qu'un token et un escrow séparés,
pour qu'un pari soit un seul appel on-chain (`placeBet`) au lieu d'une paire `approve` +
`transferFrom`.

Écrit à la main, sans OpenZeppelin ni aucune autre librairie externe : chaque ligne (ERC-20 minimal,
mint, création/résolution de marché, règlement pari-mutuel) est explicable directement à la lecture,
sans dépendre d'une implémentation externe.

Fonctions principales :

- `mint(address, amount)` — réservé au owner (déployeur du contrat), crédite un compte.
- `createMarket(marketId)` — réservé au owner, initialise un marché avec une liquidité virtuelle de
  départ (50/50) qui sert uniquement à afficher une cote de départ neutre, jamais réellement due à
  personne.
- `placeBet(marketId, side, amount)` — débite l'appelant, met les tokens en escrow dans le contrat,
  incrémente le pool du camp choisi.
- `resolveMarket(marketId, outcome)` — réservé au owner, calcule le règlement pari-mutuel (les
  gagnants se partagent l'argent réellement misé, proportionnellement à leur mise ; remboursement
  intégral si personne n'a parié sur le camp gagnant) et transfère les gains directement aux gagnants.
  Le payout de chaque pari est aussi stocké on-chain (`getBet` le renvoie), pour que l'API puisse le
  recopier telle quelle plutôt que de le recalculer.
- Events `Transfer`, `BetPlaced`, `MarketResolved` pour la traçabilité.

### Marchés à options multiples

Fonctions jumelles pour les marchés à plus de deux issues (ex. "qui remporte le tournoi ?"), ajoutées
sans toucher aux fonctions ci-dessus : un marché OUI/NON reste géré par `markets`/`placeBet`/
`resolveMarket`, un marché à options multiples par `multiMarkets`/`placeMultiBet`/`resolveMultiMarket`
— même contrat, même adresse déployée, deux jeux de fonctions parallèles.

- `createMultiMarket(marketId, optionCount)` — réservé au owner, `optionCount` entre 3 et 6
  (`MIN_OUTCOMES`/`MAX_OUTCOMES`), initialise un pool de liquidité virtuelle (50) par option.
- `placeMultiBet(marketId, optionIndex, amount)` — même logique que `placeBet`, mais mise sur une
  option (son index) parmi N plutôt que sur OUI/NON.
- `resolveMultiMarket(marketId, winningOption)` — même règlement pari-mutuel que `resolveMarket`,
  généralisé à N pools : le pot réellement misé (toutes options confondues) est reversé aux parieurs de
  l'option gagnante, proportionnellement à leur mise.
- `getMultiMarket(marketId)` — vue explicite (pools, volume, statut, option gagnante) : contrairement à
  `markets`, `multiMarkets` est une mapping privée car un getter public auto-généré ne peut pas exposer
  un tableau dynamique (`uint256[] pools`) dans un struct.
- `getMultiBetCount`/`getMultiBet` — équivalents de `getBetCount`/`getBet` pour l'historique des paris
  à options multiples.

C'est une généralisation directe du modèle binaire (courses hippiques à N chevaux plutôt qu'à 2), pas
une redirection sur des OpenZeppelin/librairies de marché prédictif : le choix a été fait pour rester
dans le même style "explicable à la lecture" que le reste du contrat, plutôt que de reproduire le vrai
mécanisme de Polymarket (N mini-marchés OUI/NON indépendants par option), nettement plus complexe.

## Tests

```bash
npx hardhat test
```

34 tests couvrant : mint, transferts/allowances ERC-20, marchés OUI/NON (création, pari, résolution —
répartition proportionnelle, reliquat d'arrondi, remboursement si personne n'a gagné, appel non-owner),
et l'équivalent pour les marchés à options multiples.

## Déploiement

```bash
npm run deploy:localhost
```

`scripts/deploy.ts` déploie le contrat sur le réseau `localhost` et écrit son adresse et son ABI dans
`../api/src/blockchain/deployment.json` (gitignored, régénéré à chaque déploiement) — l'API n'a jamais
besoin d'aller chercher dans le dossier `artifacts` de Hardhat au runtime.

## Nœud local

Deux façons de le démarrer :

- `npx hardhat node` directement.
- Le service `hardhat` de `docker-compose.yml` à la racine du repo : `docker-entrypoint.sh` installe
  les dépendances, démarre le nœud, attend que le port 8545 réponde, puis déploie le contrat
  automatiquement.

Les comptes de test générés par Hardhat (adresses et clés privées) sont déterministes et publiquement
documentés — c'est volontaire : le compte #0 sert de compte owner/funder côté API (voir
`HARDHAT_FUNDER_PRIVATE_KEY` dans `apps/api/.env`).

## Limites assumées du POC

- Réseau Hardhat local uniquement, pas de réseau public (testnet ou mainnet).
- Pas de wallet externe (MetaMask ou autre) : les utilisateurs ont un wallet custodial généré par le
  backend, qui signe leurs transactions pour eux (détail côté `apps/api/README.md`).
- Le gas des transactions est payé en ETH de test distribué par le compte owner à la création de
  chaque compte — pas de vraie économie de gas à gérer.
- Un seul compte owner/déployeur contrôle `mint`/`createMarket`/`resolveMarket` : point de
  centralisation acceptable pour un POC pédagogique, à ne pas reproduire tel quel en production.
- **Le nœud Hardhat ne persiste pas son état** : chaque redémarrage du service `hardhat` (ou de
  `npx hardhat node`) repart d'une chaîne vierge et redéploie le contrat à une nouvelle adresse — tous
  les marchés/soldes existants sur l'ancienne chaîne disparaissent, alors que Postgres garde ses lignes
  telles quelles. C'est la source la plus fréquente de désynchronisation rencontrée en développement.
  Le tableau de bord admin **Diagnostics** (`/admin/diagnostics`, voir `apps/web/README.md`) détecte ce
  cas (marché absent on-chain, solde qui a dérivé) et propose une correction en un clic plutôt que de
  nécessiter une intervention manuelle en base.
