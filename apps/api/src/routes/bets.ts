import { Router } from "express";
import { type BetSide, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { currentUserRole, requireAuth } from "../middleware/auth.js";
import { computePrices } from "../pricing.js";
import {
  getOnChainBalance,
  getReadOnlyContract,
  getUserContract,
  revertReason,
  sideToOutcome,
} from "../blockchain/contract.js";
import { fromChainAmount, toChainAmount } from "../blockchain/units.js";

export const betsRouter = Router();

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
  if (!user.walletAddress || !user.encryptedPrivateKey) {
    res.status(400).json({ error: "User has no custodial wallet" });
    return;
  }
  const walletAddress = user.walletAddress;

  const { yesPrice: priceAtBet, noPrice: noPriceAtBet } = computePrices(market);
  const betSide = side as BetSide;

  let txHash: string;
  try {
    const tx = await getUserContract(user).placeBet(market.id, sideToOutcome(betSide), toChainAmount(amount));
    txHash = tx.hash;
    await tx.wait();
  } catch (err) {
    res.status(400).json({ error: revertReason(err) ?? "Could not place the bet on-chain" });
    return;
  }

  const onChainMarket = await getReadOnlyContract().markets(market.id);
  const newBalance = await getOnChainBalance(walletAddress);

  const { bet, updatedMarket } = await prisma.$transaction(async (tx) => {
    const bet = await tx.bet.create({
      data: {
        userId: user.id,
        marketId: market.id,
        side: betSide,
        amount,
        price: betSide === "YES" ? priceAtBet : noPriceAtBet,
        txHash,
      },
    });

    const updatedMarket = await tx.market.update({
      where: { id: market.id },
      data: {
        yesPool: fromChainAmount(onChainMarket.yesPool),
        noPool: fromChainAmount(onChainMarket.noPool),
        totalVolume: fromChainAmount(onChainMarket.totalVolume),
      },
    });

    const newPrices = computePrices(updatedMarket);
    await tx.pricePoint.create({ data: { marketId: market.id, yesPrice: newPrices.yesPrice } });
    await tx.user.update({ where: { id: user.id }, data: { walletBalance: newBalance } });

    return { bet, updatedMarket };
  });

  res.status(201).json({
    bet,
    market: { ...updatedMarket, ...computePrices(updatedMarket) },
  });
});

betsRouter.get("/", requireAuth, async (req, res) => {
  const { status, all } = req.query;

  const isAdminAll = all === "true" && (await currentUserRole(req.user!.userId)) === "ADMIN";

  const where: Prisma.BetWhereInput = isAdminAll ? {} : { userId: req.user!.userId };
  if (status === "ongoing") where.market = { status: "OPEN" };
  else if (status === "past") where.market = { status: "RESOLVED" };

  const bets = isAdminAll
    ? await prisma.bet.findMany({
        where,
        include: {
          market: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              role: true,
              walletBalance: true,
              walletAddress: true,
              createdAt: true,
            },
          },
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
  if (bet.userId !== req.user!.userId && (await currentUserRole(req.user!.userId)) !== "ADMIN") {
    res.status(403).json({ error: "Not allowed to view this bet" });
    return;
  }
  res.json({ bet });
});
