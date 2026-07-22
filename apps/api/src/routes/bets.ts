import { Router } from "express";
import { type BetSide, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { currentUserRole, requireAuth } from "../middleware/auth.js";
import { computeOptionPrices, computePrices } from "../pricing.js";
import {
  getOnChainBalance,
  getReadOnlyContract,
  getUserContract,
  readPlacedBetIndex,
  revertReason,
  sideToOutcome,
} from "../blockchain/contract.js";
import { runAsSender } from "../blockchain/provider.js";
import { fromChainAmount, toChainAmount } from "../blockchain/units.js";

export const betsRouter = Router();

betsRouter.post("/", requireAuth, async (req, res) => {
  const { marketId, side, optionId, amount } = req.body ?? {};

  if (typeof marketId !== "string") {
    res.status(400).json({ error: "marketId is required" });
    return;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  let betSide: BetSide | undefined;
  let option: (typeof market.options)[number] | undefined;

  if (market.type === "MULTI") {
    if (typeof optionId !== "string") {
      res.status(400).json({ error: "optionId is required" });
      return;
    }
    option = market.options.find((o) => o.id === optionId);
    if (!option) {
      res.status(400).json({ error: "optionId does not belong to this market" });
      return;
    }
  } else {
    if (side !== "YES" && side !== "NO") {
      res.status(400).json({ error: "side must be YES or NO" });
      return;
    }
    betSide = side as BetSide;
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
  if (user.role === "ADMIN") {
    res.status(403).json({ error: "Admins are not allowed to place bets" });
    return;
  }
  if (!user.walletAddress || !user.encryptedPrivateKey) {
    res.status(400).json({ error: "User has no custodial wallet" });
    return;
  }
  const walletAddress = user.walletAddress;

  let priceAtBet: number;
  if (market.type === "MULTI") {
    const priced = computeOptionPrices(market.options);
    priceAtBet = priced.find((o) => o.id === option!.id)!.price;
  } else {
    const { yesPrice, noPrice } = computePrices(market);
    priceAtBet = betSide === "YES" ? yesPrice : noPrice;
  }

  let txHash: string;
  let chainIndex: number;
  try {
    const { hash, receipt } = await runAsSender(walletAddress, async (nonce) => {
      const tx =
        market.type === "MULTI"
          ? await getUserContract(user).placeMultiBet(market.id, option!.sortOrder, toChainAmount(amount), { nonce })
          : await getUserContract(user).placeBet(market.id, sideToOutcome(betSide!), toChainAmount(amount), { nonce });
      return { hash: tx.hash, receipt: await tx.wait() };
    });
    txHash = hash;
    chainIndex = readPlacedBetIndex(receipt, market.type === "MULTI" ? "MultiBetPlaced" : "BetPlaced");
  } catch (err) {
    res.status(400).json({ error: revertReason(err) ?? "Could not place the bet on-chain" });
    return;
  }

  const settledAmount = fromChainAmount(toChainAmount(amount));

  try {
    const newBalance = await getOnChainBalance(walletAddress);

    if (market.type === "MULTI") {
      const [pools, totalVolumeUnits] = await getReadOnlyContract().getMultiMarket(market.id);

      const { bet } = await prisma.$transaction(async (tx) => {
        const bet = await tx.bet.create({
          data: {
            userId: user.id,
            marketId: market.id,
            optionId: option!.id,
            amount: settledAmount,
            price: priceAtBet,
            txHash,
            chainIndex,
          },
        });

        for (let i = 0; i < market.options.length; i++) {
          await tx.marketOption.update({
            where: { id: market.options[i].id },
            data: { pool: fromChainAmount(pools[i]) },
          });
        }
        await tx.market.update({
          where: { id: market.id },
          data: { totalVolume: fromChainAmount(totalVolumeUnits) },
        });

        const newPrices = computeOptionPrices(
          market.options.map((o, i) => ({ ...o, pool: fromChainAmount(pools[i]) })),
        );
        const priceTimestamp = new Date();
        await tx.optionPricePoint.createMany({
          data: newPrices.map((o) => ({ optionId: o.id, price: o.price, timestamp: priceTimestamp })),
        });
        await tx.user.update({ where: { id: user.id }, data: { walletBalance: newBalance } });

        return { bet };
      });

      const updatedMarket = await prisma.market.findUniqueOrThrow({
        where: { id: market.id },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      });

      res.status(201).json({
        bet,
        market: { ...updatedMarket, options: computeOptionPrices(updatedMarket.options) },
      });
      return;
    }

    const onChainMarket = await getReadOnlyContract().markets(market.id);

    const { bet, updatedMarket } = await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.create({
        data: {
          userId: user.id,
          marketId: market.id,
          side: betSide,
          amount: settledAmount,
          price: priceAtBet,
          txHash,
          chainIndex,
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
  } catch (err) {
    console.error(
      `Bet placed on-chain (tx ${txHash}) but syncing it to the database failed — user ${user.id}, market ${market.id}, amount ${settledAmount}:`,
      err,
    );
    res.status(500).json({
      error: `Your bet was placed on-chain (tx ${txHash}) but could not be recorded. Contact an admin with this transaction hash.`,
    });
  }
});

// Refunds a bet in full while its market is still open — a pari-mutuel pool
// has no counterparty to sell to before resolution, so this is a full
// self-refund/cancellation, not a sale at the current market price (see
// GUIDE_UTILISATEUR.md).
betsRouter.post("/:id/withdraw", requireAuth, async (req, res) => {
  const bet = await prisma.bet.findUnique({ where: { id: req.params.id }, include: { market: true } });
  if (!bet) {
    res.status(404).json({ error: "Bet not found" });
    return;
  }
  if (bet.userId !== req.user!.userId) {
    res.status(403).json({ error: "Not allowed to withdraw this bet" });
    return;
  }
  if (bet.market.status !== "OPEN") {
    res.status(400).json({ error: "Market is not open for betting" });
    return;
  }
  if (bet.withdrawnAt || bet.payout !== null) {
    res.status(400).json({ error: "Bet already settled" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !user.walletAddress || !user.encryptedPrivateKey) {
    res.status(400).json({ error: "User has no custodial wallet" });
    return;
  }
  const walletAddress = user.walletAddress;

  let txHash: string;
  try {
    txHash = await runAsSender(walletAddress, async (nonce) => {
      const tx =
        bet.market.type === "MULTI"
          ? await getUserContract(user).withdrawMultiBet(bet.marketId, bet.chainIndex, { nonce })
          : await getUserContract(user).withdrawBet(bet.marketId, bet.chainIndex, { nonce });
      await tx.wait();
      return tx.hash;
    });
  } catch (err) {
    res.status(400).json({ error: revertReason(err) ?? "Could not withdraw the bet on-chain" });
    return;
  }

  try {
    const newBalance = await getOnChainBalance(walletAddress);

    if (bet.market.type === "MULTI") {
      const [pools, totalVolumeUnits] = await getReadOnlyContract().getMultiMarket(bet.marketId);
      const options = await prisma.marketOption.findMany({
        where: { marketId: bet.marketId },
        orderBy: { sortOrder: "asc" },
      });

      const updatedBet = await prisma.$transaction(async (tx) => {
        const updatedBet = await tx.bet.update({
          where: { id: bet.id },
          data: { withdrawnAt: new Date(), payout: bet.amount },
        });
        for (let i = 0; i < options.length; i++) {
          await tx.marketOption.update({ where: { id: options[i].id }, data: { pool: fromChainAmount(pools[i]) } });
        }
        await tx.market.update({ where: { id: bet.marketId }, data: { totalVolume: fromChainAmount(totalVolumeUnits) } });

        const newPrices = computeOptionPrices(options.map((o, i) => ({ ...o, pool: fromChainAmount(pools[i]) })));
        const priceTimestamp = new Date();
        await tx.optionPricePoint.createMany({
          data: newPrices.map((o) => ({ optionId: o.id, price: o.price, timestamp: priceTimestamp })),
        });
        await tx.user.update({ where: { id: user.id }, data: { walletBalance: newBalance } });

        return updatedBet;
      });

      const updatedMarket = await prisma.market.findUniqueOrThrow({
        where: { id: bet.marketId },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      });
      res.json({ bet: updatedBet, market: { ...updatedMarket, options: computeOptionPrices(updatedMarket.options) } });
      return;
    }

    const onChainMarket = await getReadOnlyContract().markets(bet.marketId);
    const { updatedBet, updatedMarket } = await prisma.$transaction(async (tx) => {
      const updatedBet = await tx.bet.update({
        where: { id: bet.id },
        data: { withdrawnAt: new Date(), payout: bet.amount },
      });
      const updatedMarket = await tx.market.update({
        where: { id: bet.marketId },
        data: {
          yesPool: fromChainAmount(onChainMarket.yesPool),
          noPool: fromChainAmount(onChainMarket.noPool),
          totalVolume: fromChainAmount(onChainMarket.totalVolume),
        },
      });

      const newPrices = computePrices(updatedMarket);
      await tx.pricePoint.create({ data: { marketId: bet.marketId, yesPrice: newPrices.yesPrice } });
      await tx.user.update({ where: { id: user.id }, data: { walletBalance: newBalance } });

      return { updatedBet, updatedMarket };
    });

    res.json({ bet: updatedBet, market: { ...updatedMarket, ...computePrices(updatedMarket) } });
  } catch (err) {
    console.error(
      `Bet withdrawn on-chain (tx ${txHash}) but syncing it to the database failed — user ${user.id}, bet ${bet.id}:`,
      err,
    );
    res.status(500).json({
      error: `Your withdrawal was processed on-chain (tx ${txHash}) but could not be recorded. Contact an admin with this transaction hash.`,
    });
  }
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
          option: true,
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
    : await prisma.bet.findMany({ where, include: { market: true, option: true }, orderBy: { createdAt: "desc" } });

  res.json({ bets });
});

betsRouter.get("/:id", requireAuth, async (req, res) => {
  const bet = await prisma.bet.findUnique({
    where: { id: req.params.id },
    include: { market: true, option: true },
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
