import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { getOnChainBalance, isBlockchainUnavailable, revertReason, syncUserBalance } from "../blockchain/contract.js";
import { createOnChainMarket, marketExistsOnChain, optionsOrder, resyncResolvedMarketPayouts } from "../marketCreation.js";

export const diagnosticsRouter = Router();

const BALANCE_DRIFT_EPSILON = 0.01;
const BLOCKCHAIN_UNAVAILABLE_MESSAGE =
  "La blockchain locale n'est pas encore joignable (elle finit peut-être de démarrer). Réessayez dans quelques secondes.";

/** Shared by GET / (thin projection for the UI) and POST /resync-all (needs the full rows to act on). */
async function computeDiagnosticsReport() {
  const openMarkets = await prisma.market.findMany({ where: { status: "OPEN" }, include: optionsOrder });
  const unsyncedMarkets = [];
  for (const market of openMarkets) {
    if (!(await marketExistsOnChain(market))) unsyncedMarkets.push(market);
  }

  const stuckBets = await prisma.bet.findMany({
    where: { market: { status: "RESOLVED" }, payout: null },
    include: {
      market: { select: { id: true, title: true, type: true, resolvedOutcome: true, resolvedOptionId: true } },
      user: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const usersWithWallet = await prisma.user.findMany({
    where: { walletAddress: { not: null } },
    select: { id: true, username: true, walletAddress: true, walletBalance: true },
  });
  const balanceDrift = [];
  for (const user of usersWithWallet) {
    const onChainBalance = await getOnChainBalance(user.walletAddress!);
    const dbBalance = Number(user.walletBalance);
    if (Math.abs(onChainBalance - dbBalance) > BALANCE_DRIFT_EPSILON) {
      balanceDrift.push({ id: user.id, username: user.username, walletAddress: user.walletAddress!, dbBalance, onChainBalance });
    }
  }

  return { unsyncedMarkets, stuckBets, balanceDrift };
}

diagnosticsRouter.get("/", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { unsyncedMarkets, stuckBets, balanceDrift } = await computeDiagnosticsReport();
    res.json({
      unsyncedMarkets: unsyncedMarkets.map((m) => ({ id: m.id, title: m.title })),
      stuckBets,
      balanceDrift: balanceDrift.map(({ id, username, dbBalance, onChainBalance }) => ({ id, username, dbBalance, onChainBalance })),
    });
  } catch (err) {
    if (isBlockchainUnavailable(err)) {
      res.status(503).json({ error: BLOCKCHAIN_UNAVAILABLE_MESSAGE, retryable: true });
      return;
    }
    throw err;
  }
});

diagnosticsRouter.post("/resync-market/:id", requireAuth, requireAdmin, async (req, res) => {
  const market = await prisma.market.findUnique({
    where: { id: req.params.id },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  try {
    if (await marketExistsOnChain(market)) {
      res.status(400).json({ error: "Market already exists on-chain" });
      return;
    }
    await createOnChainMarket(market.id, market.type, market.options.length);
    res.json({ ok: true });
  } catch (err) {
    if (isBlockchainUnavailable(err)) {
      res.status(503).json({ error: BLOCKCHAIN_UNAVAILABLE_MESSAGE, retryable: true });
      return;
    }
    console.error(`Could not recreate on-chain market ${market.id}:`, err);
    res.status(502).json({ error: revertReason(err) ?? "Could not recreate the market on-chain" });
  }
});

diagnosticsRouter.post("/resync-balance/:userId", requireAuth, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!user.walletAddress) {
    res.status(400).json({ error: "User has no custodial wallet" });
    return;
  }

  try {
    const walletBalance = await syncUserBalance(user.id, user.walletAddress);
    res.json({ walletBalance });
  } catch (err) {
    if (isBlockchainUnavailable(err)) {
      res.status(503).json({ error: BLOCKCHAIN_UNAVAILABLE_MESSAGE, retryable: true });
      return;
    }
    throw err;
  }
});

// One-click version of the three routes above — recreates every unsynced
// market, resyncs every stuck bet's payout, and realigns every drifted
// balance in one call, for the "just recovering from a Hardhat restart"
// situation where there can be many of each at once. Each item is attempted
// independently (one failure doesn't abort the rest) and every outcome is
// reported back rather than swallowed, since these are real on-chain writes
// that can individually fail (e.g. a transient RPC hiccup).
diagnosticsRouter.post("/resync-all", requireAuth, requireAdmin, async (_req, res) => {
  let report: Awaited<ReturnType<typeof computeDiagnosticsReport>>;
  try {
    report = await computeDiagnosticsReport();
  } catch (err) {
    if (isBlockchainUnavailable(err)) {
      res.status(503).json({ error: BLOCKCHAIN_UNAVAILABLE_MESSAGE, retryable: true });
      return;
    }
    throw err;
  }

  const markets = { recreated: 0, failed: [] as { id: string; title: string; error: string }[] };
  for (const market of report.unsyncedMarkets) {
    try {
      await createOnChainMarket(market.id, market.type, market.options.length);
      markets.recreated += 1;
    } catch (err) {
      console.error(`resync-all: could not recreate market ${market.id}:`, err);
      markets.failed.push({ id: market.id, title: market.title, error: revertReason(err) ?? "Could not recreate the market on-chain" });
    }
  }

  // Stuck bets are grouped by market — resyncResolvedMarketPayouts processes
  // a whole market's bets in one go, so a market with 5 stuck bets is one
  // on-chain read batch + one Postgres transaction, not five.
  const marketsById = new Map(report.stuckBets.map((bet) => [bet.market.id, bet.market]));
  const bets = { resynced: 0, failed: [] as { marketId: string; title: string; error: string }[] };
  for (const market of marketsById.values()) {
    try {
      await resyncResolvedMarketPayouts(market);
      bets.resynced += 1;
    } catch (err) {
      console.error(`resync-all: could not resync payouts for market ${market.id}:`, err);
      bets.failed.push({ marketId: market.id, title: market.title, error: revertReason(err) ?? "Could not resync payouts" });
    }
  }

  const balances = { resynced: 0, failed: [] as { id: string; username: string; error: string }[] };
  for (const drift of report.balanceDrift) {
    try {
      await syncUserBalance(drift.id, drift.walletAddress);
      balances.resynced += 1;
    } catch (err) {
      console.error(`resync-all: could not resync balance for user ${drift.id}:`, err);
      balances.failed.push({ id: drift.id, username: drift.username, error: revertReason(err) ?? "Could not resync balance" });
    }
  }

  res.json({ markets, bets, balances });
});
