import { Router } from "express";
import { type BetSide, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { computePrices } from "../pricing.js";

export const betsRouter = Router();

class InsufficientBalanceError extends Error {}

betsRouter.post("/", requireAuth, async (req, res) => {
  const { marketId, side, amount } = req.body ?? {};

  if (typeof marketId !== "string") {
    res.status(400).json({ error: "marketId is required" });
    return;
  }
  if (side !== "YES" && side !== "NO") {
    res.status(400).json({ error: "side must be YES or NO" });
    return;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  if (market.status !== "OPEN") {
    res.status(400).json({ error: "Market is not open for betting" });
    return;
  }

  const now = new Date();
  if (now < market.startDate) {
    res.status(400).json({ error: "Market has not started yet" });
    return;
  }
  if (now > market.endDate) {
    res.status(400).json({ error: "Market betting period has ended" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { yesPrice: priceAtBet, noPrice: noPriceAtBet } = computePrices(market);
  const betSide = side as BetSide;

  try {
    const { bet, market: updatedMarket } = await prisma.$transaction(async (tx) => {
      // Atomic check-and-decrement: the WHERE clause re-evaluates the balance
      // at commit time, so two concurrent bets can't both read a stale
      // sufficient balance and overdraw the wallet.
      const debited = await tx.user.updateMany({
        where: { id: user.id, walletBalance: { gte: amount } },
        data: { walletBalance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new InsufficientBalanceError();
      }

      const updatedMarket = await tx.market.update({
        where: { id: market.id },
        data: {
          yesPool: betSide === "YES" ? { increment: amount } : undefined,
          noPool: betSide === "NO" ? { increment: amount } : undefined,
          totalVolume: { increment: amount },
        },
      });

      const bet = await tx.bet.create({
        data: {
          userId: user.id,
          marketId: market.id,
          side: betSide,
          amount,
          price: betSide === "YES" ? priceAtBet : noPriceAtBet,
        },
      });

      const newPrices = computePrices(updatedMarket);
      await tx.pricePoint.create({
        data: { marketId: market.id, yesPrice: newPrices.yesPrice },
      });

      return { bet, market: updatedMarket };
    });

    res.status(201).json({
      bet,
      market: { ...updatedMarket, ...computePrices(updatedMarket) },
    });
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      res.status(400).json({ error: "Insufficient wallet balance" });
      return;
    }
    throw err;
  }
});

betsRouter.get("/", requireAuth, async (req, res) => {
  const { status, all } = req.query;

  // Re-check the role against the database rather than the JWT claim (see
  // requireAdmin in middleware/auth.ts for why: a stale token would otherwise
  // let a just-demoted user keep pulling every other user's bets).
  let isAdminAll = false;
  if (all === "true") {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true },
    });
    isAdminAll = currentUser?.role === "ADMIN";
  }

  const where: Prisma.BetWhereInput = isAdminAll ? {} : { userId: req.user!.userId };
  if (status === "ongoing") where.market = { status: "OPEN" };
  else if (status === "past") where.market = { status: "RESOLVED" };

  const bets = isAdminAll
    ? await prisma.bet.findMany({
        where,
        include: {
          market: true,
          user: { select: { id: true, email: true, username: true, role: true, walletBalance: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.bet.findMany({ where, include: { market: true }, orderBy: { createdAt: "desc" } });

  res.json({ bets });
});

betsRouter.get("/:id", requireAuth, async (req, res) => {
  const bet = await prisma.bet.findUnique({
    where: { id: req.params.id },
    include: { market: true },
  });
  if (!bet) {
    res.status(404).json({ error: "Bet not found" });
    return;
  }
  if (bet.userId !== req.user!.userId && req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Not allowed to view this bet" });
    return;
  }
  res.json({ bet });
});

betsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const bet = await prisma.bet.findUnique({
    where: { id: req.params.id },
    include: { market: true },
  });
  if (!bet) {
    res.status(404).json({ error: "Bet not found" });
    return;
  }
  if (bet.market.status !== "OPEN") {
    res.status(400).json({ error: "Cannot void a bet on a resolved market" });
    return;
  }

  const amount = Number(bet.amount);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: bet.userId },
      data: { walletBalance: { increment: amount } },
    });
    await tx.market.update({
      where: { id: bet.marketId },
      data: {
        yesPool: bet.side === "YES" ? { decrement: amount } : undefined,
        noPool: bet.side === "NO" ? { decrement: amount } : undefined,
        totalVolume: { decrement: amount },
      },
    });
    await tx.bet.delete({ where: { id: bet.id } });
  });

  res.status(204).send();
});
