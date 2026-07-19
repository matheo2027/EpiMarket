import { Router } from "express";
import { MarketCategory, MarketStatus, type Market } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { computePrices } from "../pricing.js";
import { getOnChainBalance, getOwnerContract, getReadOnlyContract, revertReason, sideToOutcome } from "../blockchain/contract.js";
import { runAsOwner } from "../blockchain/provider.js";
import { fromChainAmount } from "../blockchain/units.js";

export const marketsRouter = Router();

const CATEGORIES = Object.values(MarketCategory);
const STATUSES = Object.values(MarketStatus);

function serializeMarket(market: Market) {
  return { ...market, ...computePrices(market) };
}

marketsRouter.get("/", async (req, res) => {
  const { status, category } = req.query;
  const where: { status?: MarketStatus; category?: MarketCategory } = {};

  if (typeof status === "string") {
    if (!STATUSES.includes(status as MarketStatus)) {
      res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
      return;
    }
    where.status = status as MarketStatus;
  }
  if (typeof category === "string") {
    if (!CATEGORIES.includes(category as MarketCategory)) {
      res.status(400).json({ error: `category must be one of ${CATEGORIES.join(", ")}` });
      return;
    }
    where.category = category as MarketCategory;
  }

  const markets = await prisma.market.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json({ markets: markets.map(serializeMarket) });
});

marketsRouter.get("/stats/history", async (_req, res) => {
  const [markets, bets] = await Promise.all([
    prisma.market.findMany({ select: { id: true, createdAt: true, status: true, resolvedAt: true } }),
    prisma.bet.findMany({ select: { createdAt: true, amount: true, userId: true, marketId: true } }),
  ]);

  if (markets.length === 0 && bets.length === 0) {
    res.json({ history: [] });
    return;
  }

  const marketById = new Map(markets.map((m) => [m.id, m]));

  const DAY_MS = 86_400_000;
  const earliestMs = Math.min(
    ...markets.map((m) => m.createdAt.getTime()),
    ...bets.map((b) => b.createdAt.getTime()),
  );
  const startDay = new Date(earliestMs);
  startDay.setUTCHours(0, 0, 0, 0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const MAX_HISTORY_DAYS = 3650;
  const totalDays = Math.min(Math.max(Math.round((today.getTime() - startDay.getTime()) / DAY_MS), 0), MAX_HISTORY_DAYS);

  function isOpenAsOf(market: { status: string; resolvedAt: Date | null }, asOf: Date): boolean {
    return market.status === "OPEN" || market.resolvedAt === null || market.resolvedAt > asOf;
  }

  const history = [];
  for (let i = 0; i <= totalDays; i++) {
    const dayEnd = new Date(startDay.getTime() + i * DAY_MS + DAY_MS - 1);

    let openMarkets = 0;
    for (const market of markets) {
      if (market.createdAt > dayEnd) continue;
      if (isOpenAsOf(market, dayEnd)) openMarkets++;
    }

    let volumeSum = 0;
    let activeBets = 0;
    const bettors = new Set<string>();
    for (const bet of bets) {
      if (bet.createdAt > dayEnd) continue;
      volumeSum += Number(bet.amount);
      const market = marketById.get(bet.marketId);
      if (market && isOpenAsOf(market, dayEnd)) {
        activeBets++;
        bettors.add(bet.userId);
      }
    }

    history.push({
      date: dayEnd.toISOString(),
      openMarkets,
      totalVolume: volumeSum.toFixed(2),
      activeBets,
      bettors: bettors.size,
    });
  }

  res.json({ history });
});

marketsRouter.get("/:id", async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  res.json({ market: serializeMarket(market) });
});

marketsRouter.get("/:id/price-history", async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  const pricePoints = await prisma.pricePoint.findMany({
    where: { marketId: market.id },
    orderBy: { timestamp: "asc" },
  });
  res.json({ pricePoints });
});

marketsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { title, description, yesDescription, noDescription, category, startDate, endDate } = req.body ?? {};

  if (typeof title !== "string" || title.trim().length < 3) {
    res.status(400).json({ error: "Title must be at least 3 characters" });
    return;
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    res.status(400).json({ error: "Description is required" });
    return;
  }
  if (typeof yesDescription !== "string" || yesDescription.trim().length === 0) {
    res.status(400).json({ error: "yesDescription is required" });
    return;
  }
  if (typeof noDescription !== "string" || noDescription.trim().length === 0) {
    res.status(400).json({ error: "noDescription is required" });
    return;
  }
  if (typeof category !== "string" || !CATEGORIES.includes(category as MarketCategory)) {
    res.status(400).json({ error: `category must be one of ${CATEGORIES.join(", ")}` });
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    res.status(400).json({ error: "Invalid startDate/endDate" });
    return;
  }
  if (end <= start) {
    res.status(400).json({ error: "endDate must be after startDate" });
    return;
  }

  const market = await prisma.market.create({
    data: {
      title: title.trim(),
      description,
      yesDescription,
      noDescription,
      category: category as MarketCategory,
      startDate: start,
      endDate: end,
      pricePoints: { create: { yesPrice: 0.5 } },
    },
  });

  try {
    const tx = await runAsOwner((nonce) => getOwnerContract().createMarket(market.id, { nonce }));
    await tx.wait();
  } catch (err) {
    console.error(`Could not create on-chain market ${market.id}:`, err);
    await prisma.market.delete({ where: { id: market.id } });
    res.status(502).json({ error: revertReason(err) ?? "Could not create the on-chain market" });
    return;
  }

  res.status(201).json({ market: serializeMarket(market) });
});

marketsRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  if (existing.status === "RESOLVED") {
    res.status(400).json({ error: "Cannot edit a resolved market" });
    return;
  }

  const { title, description, yesDescription, noDescription, category, startDate, endDate } = req.body ?? {};
  const data: Record<string, unknown> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length < 3) {
      res.status(400).json({ error: "Title must be at least 3 characters" });
      return;
    }
    data.title = title.trim();
  }
  if (description !== undefined) {
    if (typeof description !== "string" || description.trim().length === 0) {
      res.status(400).json({ error: "Description is required" });
      return;
    }
    data.description = description;
  }
  if (yesDescription !== undefined) {
    if (typeof yesDescription !== "string" || yesDescription.trim().length === 0) {
      res.status(400).json({ error: "yesDescription is required" });
      return;
    }
    data.yesDescription = yesDescription;
  }
  if (noDescription !== undefined) {
    if (typeof noDescription !== "string" || noDescription.trim().length === 0) {
      res.status(400).json({ error: "noDescription is required" });
      return;
    }
    data.noDescription = noDescription;
  }
  if (category !== undefined) {
    if (!CATEGORIES.includes(category as MarketCategory)) {
      res.status(400).json({ error: `category must be one of ${CATEGORIES.join(", ")}` });
      return;
    }
    data.category = category;
  }
  if (startDate !== undefined) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      res.status(400).json({ error: "Invalid startDate" });
      return;
    }
    data.startDate = start;
  }
  if (endDate !== undefined) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      res.status(400).json({ error: "Invalid endDate" });
      return;
    }
    data.endDate = end;
  }

  const market = await prisma.market.update({ where: { id: req.params.id }, data });
  res.json({ market: serializeMarket(market) });
});

marketsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  if (existing.status === "RESOLVED") {
    res.status(400).json({ error: "Cannot delete a resolved market" });
    return;
  }

  const betCount = await prisma.bet.count({ where: { marketId: existing.id } });
  if (betCount > 0) {
    res.status(400).json({ error: "Cannot delete a market that already has bets. Resolve it instead." });
    return;
  }

  await prisma.market.delete({ where: { id: existing.id } });
  res.status(204).send();
});

marketsRouter.post("/:id/resolve", requireAuth, requireAdmin, async (req, res) => {
  const { outcome } = req.body ?? {};
  if (outcome !== "YES" && outcome !== "NO") {
    res.status(400).json({ error: "outcome must be YES or NO" });
    return;
  }

  const existing = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  let resync = false;
  if (existing.status === "RESOLVED") {
    const unsyncedCount = await prisma.bet.count({ where: { marketId: existing.id, payout: null } });
    if (unsyncedCount === 0) {
      res.status(400).json({ error: "Market is already resolved" });
      return;
    }
    if (existing.resolvedOutcome !== outcome) {
      res.status(409).json({
        error: `Market already resolved on-chain as ${existing.resolvedOutcome}; resend with that outcome to retry syncing payouts.`,
      });
      return;
    }
    // The market resolved on-chain successfully on a previous call, but syncing
    // payouts/balances to Postgres failed partway through — retry just that part
    // instead of leaving it permanently stuck (the earlier call already committed
    // status: RESOLVED, so we can't re-claim or re-run the on-chain tx here).
    resync = true;
  }

  try {
    if (!resync) {
      const claimed = await prisma.market.updateMany({
        where: { id: existing.id, status: "OPEN" },
        data: { status: "RESOLVED", resolvedOutcome: outcome, resolvedAt: new Date() },
      });
      if (claimed.count === 0) {
        res.status(400).json({ error: "Market is already resolved" });
        return;
      }

      try {
        const tx = await runAsOwner((nonce) =>
          getOwnerContract().resolveMarket(existing.id, sideToOutcome(outcome), { nonce }),
        );
        await tx.wait();
      } catch (err) {
        console.error(`Could not resolve on-chain market ${existing.id}:`, err);
        await prisma.market.update({
          where: { id: existing.id },
          data: { status: "OPEN", resolvedOutcome: null, resolvedAt: null },
        });
        res.status(502).json({ error: revertReason(err) ?? "Could not resolve the on-chain market" });
        return;
      }
    }

    const bets = await prisma.bet.findMany({ where: { marketId: existing.id }, orderBy: { id: "asc" } });
    const readContract = getReadOnlyContract();
    const payouts = await Promise.all(
      bets.map(async (_, i) => {
        const [, , , payoutUnits] = await readContract.getBet(existing.id, i);
        return fromChainAmount(payoutUnits);
      }),
    );

    const bettorIds = [...new Set(bets.map((bet) => bet.userId))];
    const bettors = await prisma.user.findMany({ where: { id: { in: bettorIds } } });
    const balanceEntries = await Promise.all(
      bettors
        .filter((bettor) => bettor.walletAddress)
        .map(async (bettor) => [bettor.id, await getOnChainBalance(bettor.walletAddress!)] as const),
    );
    const balances = new Map(balanceEntries);

    const market = await prisma.$transaction(async (tx) => {
      for (let i = 0; i < bets.length; i++) {
        await tx.bet.update({ where: { id: bets[i].id }, data: { payout: payouts[i] } });
      }
      for (const [userId, walletBalance] of balances) {
        await tx.user.update({ where: { id: userId }, data: { walletBalance } });
      }
      return tx.market.findUniqueOrThrow({ where: { id: existing.id } });
    });

    res.json({ market: serializeMarket(market) });
  } catch (err) {
    console.error("Market resolved on-chain but syncing Postgres failed:", err);
    res.status(500).json({ error: "Market resolved on-chain, but syncing the result failed. Check server logs." });
  }
});
