import { Router } from "express";
import { MarketCategory, MarketStatus, type Market } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { computePrices } from "../pricing.js";
import { ConcurrencyError } from "../errors.js";

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
      // Nested write: the market and its seed price point are created in a
      // single atomic insert, so a crash between two separate calls can't
      // leave a market with no starting point for the price chart.
      pricePoints: { create: { yesPrice: 0.5 } },
    },
  });

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

  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (yesDescription !== undefined) data.yesDescription = yesDescription;
  if (noDescription !== undefined) data.noDescription = noDescription;
  if (category !== undefined) {
    if (!CATEGORIES.includes(category as MarketCategory)) {
      res.status(400).json({ error: `category must be one of ${CATEGORIES.join(", ")}` });
      return;
    }
    data.category = category;
  }
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);

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
  if (existing.status === "RESOLVED") {
    res.status(400).json({ error: "Market is already resolved" });
    return;
  }

  try {
    const market = await prisma.$transaction(async (tx) => {
      // Atomically claim the resolve: only the request that flips OPEN ->
      // RESOLVED proceeds, so two concurrent "Conclure" clicks can't both
      // read status=OPEN and both pay out winners.
      const claimed = await tx.market.updateMany({
        where: { id: existing.id, status: "OPEN" },
        data: { status: "RESOLVED", resolvedOutcome: outcome, resolvedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ConcurrencyError("Market is already resolved");
      }

      // Deterministic order (not insertion/row order, which Postgres doesn't
      // guarantee) so which specific winner absorbs the rounding remainder
      // below is reproducible rather than arbitrary.
      const bets = await tx.bet.findMany({ where: { marketId: existing.id }, orderBy: { id: "asc" } });

      // Pari-mutuel settlement: winners split the real money wagered (not
      // the virtual seed liquidity) proportionally to their stake. If nobody
      // bet on the winning side, every bet is refunded instead (push).
      const totalPool = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);
      const winningBets = bets.filter((bet) => bet.side === outcome);
      const winningPool = winningBets.reduce((sum, bet) => sum + Number(bet.amount), 0);

      const payouts = new Map<string, number>();
      for (const bet of bets) {
        if (winningPool === 0) {
          payouts.set(bet.id, Number(bet.amount));
        } else if (bet.side === outcome) {
          payouts.set(bet.id, Math.round((Number(bet.amount) / winningPool) * totalPool * 100) / 100);
        } else {
          payouts.set(bet.id, 0);
        }
      }

      // Rounding each payout to the cent independently can leave the sum a
      // cent or two off totalPool; hand that remainder to the last winner so
      // the payouts always reconcile exactly.
      if (winningPool > 0 && winningBets.length > 0) {
        const distributed = winningBets.reduce((sum, bet) => sum + (payouts.get(bet.id) ?? 0), 0);
        const remainder = Math.round((totalPool - distributed) * 100) / 100;
        const lastWinner = winningBets[winningBets.length - 1];
        payouts.set(lastWinner.id, Math.round(((payouts.get(lastWinner.id) ?? 0) + remainder) * 100) / 100);
      }

      for (const bet of bets) {
        const payout = payouts.get(bet.id) ?? 0;
        if (payout > 0) {
          await tx.user.update({
            where: { id: bet.userId },
            data: { walletBalance: { increment: payout } },
          });
        }
        await tx.bet.update({ where: { id: bet.id }, data: { payout } });
      }

      return tx.market.findUniqueOrThrow({ where: { id: existing.id } });
    });

    res.json({ market: serializeMarket(market) });
  } catch (err) {
    if (err instanceof ConcurrencyError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
