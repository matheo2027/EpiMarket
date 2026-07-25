import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  getOnChainBalance,
  getReadOnlyContract,
  isBlockchainUnavailable,
  revertReason,
  syncUserBalance,
} from "../blockchain/contract.js";
import { createOnChainMarket } from "../marketCreation.js";

export const diagnosticsRouter = Router();

const BALANCE_DRIFT_EPSILON = 0.01;
const BLOCKCHAIN_UNAVAILABLE_MESSAGE =
  "La blockchain locale n'est pas encore joignable (elle finit peut-être de démarrer). Réessayez dans quelques secondes.";

diagnosticsRouter.get("/", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const readContract = getReadOnlyContract();

    const openMarkets = await prisma.market.findMany({ where: { status: "OPEN" } });
    const unsyncedMarkets = [];
    for (const market of openMarkets) {
      if (market.type === "MULTI") {
        const onChain = await readContract.getMultiMarket(market.id);
        const exists = onChain.exists ?? onChain[4];
        if (!exists) unsyncedMarkets.push({ id: market.id, title: market.title });
      } else {
        const onChain = await readContract.markets(market.id);
        const exists = onChain.exists ?? onChain[5];
        if (!exists) unsyncedMarkets.push({ id: market.id, title: market.title });
      }
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
        balanceDrift.push({ id: user.id, username: user.username, dbBalance, onChainBalance });
      }
    }

    res.json({ unsyncedMarkets, stuckBets, balanceDrift });
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
    const readContract = getReadOnlyContract();

    if (market.type === "MULTI") {
      const onChain = await readContract.getMultiMarket(market.id);
      const exists = onChain.exists ?? onChain[4];
      if (exists) {
        res.status(400).json({ error: "Market already exists on-chain" });
        return;
      }
      await createOnChainMarket(market.id, "MULTI", market.options.length);
      res.json({ ok: true });
      return;
    }

    const onChain = await readContract.markets(market.id);
    const exists = onChain.exists ?? onChain[5];
    if (exists) {
      res.status(400).json({ error: "Market already exists on-chain" });
      return;
    }

    await createOnChainMarket(market.id, "BINARY");
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
