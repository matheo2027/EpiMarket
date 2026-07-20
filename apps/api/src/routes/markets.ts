import { Router } from "express";
import { MarketCategory, MarketStatus, MarketType, type Market, type MarketOption } from "@prisma/client";
import { prisma } from "../prisma.js";
import { currentUserRole, requireAdmin, requireAuth } from "../middleware/auth.js";
import { computeOptionPrices, computePrices } from "../pricing.js";
import { getOnChainBalance, getOwnerContract, getReadOnlyContract, revertReason, sideToOutcome } from "../blockchain/contract.js";
import { runAsOwner } from "../blockchain/provider.js";
import { fromChainAmount } from "../blockchain/units.js";

export const marketsRouter = Router();

const CATEGORIES = Object.values(MarketCategory);
const STATUSES = Object.values(MarketStatus);
const MIN_OPTIONS = 3;
const MAX_OPTIONS = 6;

const optionsOrder = { options: { orderBy: { sortOrder: "asc" as const } } };

function serializeMarket(market: Market & { options?: MarketOption[] }) {
  if (market.type === "MULTI") {
    return { ...market, options: computeOptionPrices(market.options ?? []) };
  }
  return { ...market, ...computePrices(market) };
}

function validateOptionLabels(options: unknown): string[] | null {
  if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return null;
  const labels = options.map((o) => (typeof o === "string" ? o.trim() : ""));
  if (labels.some((l) => l.length === 0)) return null;
  return labels;
}

const SORTS = {
  recent: { createdAt: "desc" as const },
  volume: { totalVolume: "desc" as const },
  closing: { endDate: "asc" as const },
};

marketsRouter.get("/", async (req, res) => {
  const { status, category, search, sort } = req.query;
  const where: { status?: MarketStatus; category?: MarketCategory; title?: { contains: string; mode: "insensitive" } } = {};

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
  if (typeof search === "string" && search.trim()) {
    where.title = { contains: search.trim(), mode: "insensitive" };
  }
  if (typeof sort === "string" && !(sort in SORTS)) {
    res.status(400).json({ error: `sort must be one of ${Object.keys(SORTS).join(", ")}` });
    return;
  }
  const orderBy = SORTS[(typeof sort === "string" ? sort : "recent") as keyof typeof SORTS];

  const markets = await prisma.market.findMany({ where, include: optionsOrder, orderBy });
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
  const market = await prisma.market.findUnique({ where: { id: req.params.id }, include: optionsOrder });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  res.json({ market: serializeMarket(market) });
});

marketsRouter.get("/:id/price-history", async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id }, include: optionsOrder });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  if (market.type === "MULTI") {
    const optionIds = market.options.map((o) => o.id);
    const optionPricePoints = await prisma.optionPricePoint.findMany({
      where: { optionId: { in: optionIds } },
      orderBy: { timestamp: "asc" },
    });
    res.json({
      options: market.options.map((o) => ({ id: o.id, label: o.label, sortOrder: o.sortOrder })),
      optionPricePoints,
    });
    return;
  }

  const pricePoints = await prisma.pricePoint.findMany({
    where: { marketId: market.id },
    orderBy: { timestamp: "asc" },
  });
  res.json({ pricePoints });
});

marketsRouter.post("/:id/favorite", requireAuth, async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  await prisma.favorite.upsert({
    where: { userId_marketId: { userId: req.user!.userId, marketId: market.id } },
    create: { userId: req.user!.userId, marketId: market.id },
    update: {},
  });
  res.status(204).send();
});

marketsRouter.delete("/:id/favorite", requireAuth, async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user!.userId, marketId: req.params.id } });
  res.status(204).send();
});

const MAX_COMMENT_LENGTH = 1000;

marketsRouter.get("/:id/comments", async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { marketId: req.params.id },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ comments });
});

marketsRouter.post("/:id/comments", requireAuth, async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  const { content } = req.body ?? {};
  if (typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  if (content.trim().length > MAX_COMMENT_LENGTH) {
    res.status(400).json({ error: `content must be at most ${MAX_COMMENT_LENGTH} characters` });
    return;
  }

  const comment = await prisma.comment.create({
    data: { content: content.trim(), userId: req.user!.userId, marketId: market.id },
    include: { user: { select: { id: true, username: true } } },
  });
  res.status(201).json({ comment });
});

marketsRouter.delete("/:id/comments/:commentId", requireAuth, async (req, res) => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
  if (!comment || comment.marketId !== req.params.id) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  if (comment.userId !== req.user!.userId && (await currentUserRole(req.user!.userId)) !== "ADMIN") {
    res.status(403).json({ error: "Not allowed to delete this comment" });
    return;
  }

  await prisma.comment.delete({ where: { id: comment.id } });
  res.status(204).send();
});

marketsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { title, description, category, startDate, endDate } = req.body ?? {};
  const type: MarketType = req.body?.type === "MULTI" ? "MULTI" : "BINARY";

  if (typeof title !== "string" || title.trim().length < 3) {
    res.status(400).json({ error: "Title must be at least 3 characters" });
    return;
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    res.status(400).json({ error: "Description is required" });
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

  let optionLabels: string[] | null = null;
  if (type === "MULTI") {
    optionLabels = validateOptionLabels(req.body?.options);
    if (!optionLabels) {
      res.status(400).json({ error: `options must be an array of ${MIN_OPTIONS} to ${MAX_OPTIONS} non-empty labels` });
      return;
    }
  } else {
    const { yesDescription, noDescription } = req.body ?? {};
    if (typeof yesDescription !== "string" || yesDescription.trim().length === 0) {
      res.status(400).json({ error: "yesDescription is required" });
      return;
    }
    if (typeof noDescription !== "string" || noDescription.trim().length === 0) {
      res.status(400).json({ error: "noDescription is required" });
      return;
    }
  }

  const market = await prisma.market.create({
    data:
      type === "MULTI"
        ? {
            title: title.trim(),
            description,
            type,
            category: category as MarketCategory,
            startDate: start,
            endDate: end,
            options: { create: optionLabels!.map((label, i) => ({ label, sortOrder: i })) },
          }
        : {
            title: title.trim(),
            description,
            yesDescription: req.body.yesDescription,
            noDescription: req.body.noDescription,
            category: category as MarketCategory,
            startDate: start,
            endDate: end,
            pricePoints: { create: { yesPrice: 0.5 } },
          },
    include: optionsOrder,
  });

  if (type === "MULTI") {
    const seededAt = new Date();
    await prisma.optionPricePoint.createMany({
      data: market.options.map((o) => ({ optionId: o.id, price: 1 / market.options.length, timestamp: seededAt })),
    });
  }

  try {
    const tx =
      type === "MULTI"
        ? await runAsOwner((nonce) => getOwnerContract().createMultiMarket(market.id, market.options.length, { nonce }))
        : await runAsOwner((nonce) => getOwnerContract().createMarket(market.id, { nonce }));
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
  const existing = await prisma.market.findUnique({ where: { id: req.params.id }, include: optionsOrder });
  if (!existing) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  if (existing.status === "RESOLVED") {
    res.status(400).json({ error: "Cannot edit a resolved market" });
    return;
  }

  const { title, description, yesDescription, noDescription, category, startDate, endDate, options } = req.body ?? {};
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
  if (existing.type === "BINARY") {
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

  let newLabels: string[] | null = null;
  if (existing.type === "MULTI" && options !== undefined) {
    if (!Array.isArray(options) || options.length !== existing.options.length) {
      res.status(400).json({ error: `options must be an array of exactly ${existing.options.length} labels` });
      return;
    }
    newLabels = options.map((o) => (typeof o === "string" ? o.trim() : ""));
    if (newLabels.some((l) => l.length === 0)) {
      res.status(400).json({ error: "Option labels cannot be empty" });
      return;
    }
  }

  const market = await prisma.$transaction(async (dbTx) => {
    if (Object.keys(data).length > 0) {
      await dbTx.market.update({ where: { id: existing.id }, data });
    }
    if (newLabels) {
      for (let i = 0; i < existing.options.length; i++) {
        await dbTx.marketOption.update({ where: { id: existing.options[i].id }, data: { label: newLabels[i] } });
      }
    }
    return dbTx.market.findUniqueOrThrow({ where: { id: existing.id }, include: optionsOrder });
  });

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
  const existing = await prisma.market.findUnique({ where: { id: req.params.id }, include: optionsOrder });
  if (!existing) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  let outcome: "YES" | "NO" | undefined;
  let winningOption: MarketOption | undefined;

  if (existing.type === "MULTI") {
    const { optionId } = req.body ?? {};
    if (typeof optionId !== "string") {
      res.status(400).json({ error: "optionId is required" });
      return;
    }
    winningOption = existing.options.find((o) => o.id === optionId);
    if (!winningOption) {
      res.status(400).json({ error: "optionId does not belong to this market" });
      return;
    }
  } else {
    const { outcome: bodyOutcome } = req.body ?? {};
    if (bodyOutcome !== "YES" && bodyOutcome !== "NO") {
      res.status(400).json({ error: "outcome must be YES or NO" });
      return;
    }
    outcome = bodyOutcome;
  }

  let resync = false;
  if (existing.status === "RESOLVED") {
    const unsyncedCount = await prisma.bet.count({ where: { marketId: existing.id, payout: null } });
    if (unsyncedCount === 0) {
      res.status(400).json({ error: "Market is already resolved" });
      return;
    }
    const mismatch =
      existing.type === "MULTI" ? existing.resolvedOptionId !== winningOption!.id : existing.resolvedOutcome !== outcome;
    if (mismatch) {
      res.status(409).json({
        error:
          existing.type === "MULTI"
            ? "Market already resolved on-chain with a different option; resend with that option to retry syncing payouts."
            : `Market already resolved on-chain as ${existing.resolvedOutcome}; resend with that outcome to retry syncing payouts.`,
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
        data:
          existing.type === "MULTI"
            ? { status: "RESOLVED", resolvedOptionId: winningOption!.id, resolvedAt: new Date() }
            : { status: "RESOLVED", resolvedOutcome: outcome, resolvedAt: new Date() },
      });
      if (claimed.count === 0) {
        res.status(400).json({ error: "Market is already resolved" });
        return;
      }

      try {
        const tx =
          existing.type === "MULTI"
            ? await runAsOwner((nonce) =>
                getOwnerContract().resolveMultiMarket(existing.id, winningOption!.sortOrder, { nonce }),
              )
            : await runAsOwner((nonce) => getOwnerContract().resolveMarket(existing.id, sideToOutcome(outcome!), { nonce }));
        await tx.wait();
      } catch (err) {
        console.error(`Could not resolve on-chain market ${existing.id}:`, err);
        await prisma.market.update({
          where: { id: existing.id },
          data:
            existing.type === "MULTI"
              ? { status: "OPEN", resolvedOptionId: null, resolvedAt: null }
              : { status: "OPEN", resolvedOutcome: null, resolvedAt: null },
        });
        res.status(502).json({ error: revertReason(err) ?? "Could not resolve the on-chain market" });
        return;
      }
    }

    const bets = await prisma.bet.findMany({ where: { marketId: existing.id }, orderBy: { id: "asc" } });
    const readContract = getReadOnlyContract();
    const payouts = await Promise.all(
      bets.map(async (bet) => {
        // Already settled by an earlier withdrawal — skip, don't overwrite the
        // refund with the contract's untouched (0) payout for that bet.
        if (bet.withdrawnAt) return null;
        const result =
          existing.type === "MULTI"
            ? await readContract.getMultiBet(existing.id, bet.chainIndex)
            : await readContract.getBet(existing.id, bet.chainIndex);
        return fromChainAmount(result[3]);
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

    const market = await prisma.$transaction(async (dbTx) => {
      for (let i = 0; i < bets.length; i++) {
        if (payouts[i] === null) continue;
        await dbTx.bet.update({ where: { id: bets[i].id }, data: { payout: payouts[i] } });
      }
      for (const [userId, walletBalance] of balances) {
        await dbTx.user.update({ where: { id: userId }, data: { walletBalance } });
      }
      return dbTx.market.findUniqueOrThrow({ where: { id: existing.id }, include: optionsOrder });
    });

    res.json({ market: serializeMarket(market) });
  } catch (err) {
    console.error("Market resolved on-chain but syncing Postgres failed:", err);
    res.status(500).json({ error: "Market resolved on-chain, but syncing the result failed. Check server logs." });
  }
});
