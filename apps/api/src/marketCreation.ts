import { MarketCategory, MarketType, type Market, type MarketOption } from "@prisma/client";
import { prisma } from "./prisma.js";
import { computeOptionPrices, computePrices } from "./pricing.js";
import {
  BLOCKCHAIN_NOT_READY_MESSAGE,
  getOnChainBalance,
  getOwnerContract,
  getReadOnlyContract,
  isContractDeployed,
  revertReason,
} from "./blockchain/contract.js";
import { runAsOwner } from "./blockchain/provider.js";
import { fromChainAmount } from "./blockchain/units.js";

export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 6;

export const optionsOrder = { options: { orderBy: { sortOrder: "asc" as const } } };

export function serializeMarket(market: Market & { options?: MarketOption[] }) {
  if (market.type === "MULTI") {
    return { ...market, options: computeOptionPrices(market.options ?? []) };
  }
  return { ...market, ...computePrices(market) };
}

/** The on-chain half of creating a market — shared by `createMarketFromFields` (brand new market) and the diagnostics "resync" route (market already in Postgres, just missing on-chain). */
export async function createOnChainMarket(id: string, type: MarketType, optionCount?: number): Promise<void> {
  const tx =
    type === "MULTI"
      ? await runAsOwner((nonce) => getOwnerContract().createMultiMarket(id, optionCount!, { nonce }))
      : await runAsOwner((nonce) => getOwnerContract().createMarket(id, { nonce }));
  await tx.wait();
}

/** Shared by the diagnostics "resync one market" and "resync everything" routes — same exists-check either way. */
export async function marketExistsOnChain(market: { id: string; type: MarketType }): Promise<boolean> {
  const readContract = getReadOnlyContract();
  if (market.type === "MULTI") {
    const onChain = await readContract.getMultiMarket(market.id);
    return Boolean(onChain.exists ?? onChain[4]);
  }
  const onChain = await readContract.markets(market.id);
  return Boolean(onChain.exists ?? onChain[5]);
}

/**
 * Recomputes `payout` for every not-withdrawn bet on an already-resolved
 * market by re-reading each bet from the contract (the source of truth for
 * the amount), then syncs the affected bettors' balances — the same "Postgres
 * half of resolution" tail used by `POST /markets/:id/resolve`'s resync path
 * (payout sync failed on a previous call) and by the diagnostics "resync
 * everything" bulk action (chain wiped by a Hardhat restart, Postgres still
 * says RESOLVED with no payout computed).
 */
export async function resyncResolvedMarketPayouts(market: { id: string; type: MarketType }) {
  const bets = await prisma.bet.findMany({ where: { marketId: market.id }, orderBy: { id: "asc" } });
  const readContract = getReadOnlyContract();
  const payouts = await Promise.all(
    bets.map(async (bet) => {
      // Already settled by an earlier withdrawal — skip, don't overwrite the
      // refund with the contract's untouched (0) payout for that bet.
      if (bet.withdrawnAt) return null;
      const result =
        market.type === "MULTI"
          ? await readContract.getMultiBet(market.id, bet.chainIndex)
          : await readContract.getBet(market.id, bet.chainIndex);
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

  return prisma.$transaction(async (dbTx) => {
    for (let i = 0; i < bets.length; i++) {
      if (payouts[i] === null) continue;
      await dbTx.bet.update({ where: { id: bets[i].id }, data: { payout: payouts[i] } });
    }
    for (const [userId, walletBalance] of balances) {
      await dbTx.user.update({ where: { id: userId }, data: { walletBalance } });
    }
    return dbTx.market.findUniqueOrThrow({ where: { id: market.id }, include: optionsOrder });
  });
}

export function validateOptionLabels(options: unknown): string[] | null {
  if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return null;
  const labels = options.map((o) => (typeof o === "string" ? o.trim() : ""));
  if (labels.some((l) => l.length === 0)) return null;
  return labels;
}

export type CreateMarketFields = {
  title: string;
  description: string;
  category: MarketCategory;
  startDate: Date;
  endDate: Date;
  type: MarketType;
  optionLabels?: string[];
  yesDescription?: string | null;
  noDescription?: string | null;
};

const CATEGORIES = Object.values(MarketCategory);

export type ValidateMarketInputResult =
  | { ok: true; fields: CreateMarketFields }
  | { ok: false; status: 400; error: string };

/**
 * Shared raw-body validation for both the admin "create market" route and
 * the user "propose a market" route — same fields, same rules, only what
 * happens to the validated result differs (create now vs. store as pending).
 */
export function validateMarketInput(body: unknown): ValidateMarketInputResult {
  const { title, description, category, startDate, endDate } = (body ?? {}) as Record<string, unknown>;
  const type: MarketType = (body as { type?: unknown })?.type === "MULTI" ? "MULTI" : "BINARY";

  if (typeof title !== "string" || title.trim().length < 3) {
    return { ok: false, status: 400, error: "Title must be at least 3 characters" };
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    return { ok: false, status: 400, error: "Description is required" };
  }
  if (typeof category !== "string" || !CATEGORIES.includes(category as MarketCategory)) {
    return { ok: false, status: 400, error: `category must be one of ${CATEGORIES.join(", ")}` };
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, status: 400, error: "Invalid startDate/endDate" };
  }
  if (end <= start) {
    return { ok: false, status: 400, error: "endDate must be after startDate" };
  }

  if (type === "MULTI") {
    const optionLabels = validateOptionLabels((body as { options?: unknown })?.options);
    if (!optionLabels) {
      return { ok: false, status: 400, error: `options must be an array of ${MIN_OPTIONS} to ${MAX_OPTIONS} non-empty labels` };
    }
    return {
      ok: true,
      fields: { title: title.trim(), description, category: category as MarketCategory, startDate: start, endDate: end, type, optionLabels },
    };
  }

  const { yesDescription, noDescription } = body as { yesDescription?: unknown; noDescription?: unknown };
  if (typeof yesDescription !== "string" || yesDescription.trim().length === 0) {
    return { ok: false, status: 400, error: "yesDescription is required" };
  }
  if (typeof noDescription !== "string" || noDescription.trim().length === 0) {
    return { ok: false, status: 400, error: "noDescription is required" };
  }
  return {
    ok: true,
    fields: { title: title.trim(), description, category: category as MarketCategory, startDate: start, endDate: end, type, yesDescription, noDescription },
  };
}

export type CreateMarketResult =
  | { ok: true; market: Market & { options: MarketOption[] } }
  | { ok: false; status: number; error: string };

/**
 * Assumes `fields` is already validated (raw-body validation stays with the
 * caller) — shared by the admin "create market" route and by proposal
 * approval so the Postgres-then-chain-then-rollback-on-failure dance only
 * lives in one place.
 */
export async function createMarketFromFields(fields: CreateMarketFields): Promise<CreateMarketResult> {
  if (!(await isContractDeployed())) {
    return { ok: false, status: 503, error: BLOCKCHAIN_NOT_READY_MESSAGE };
  }

  const { title, description, category, startDate, endDate, type, optionLabels, yesDescription, noDescription } =
    fields;

  const market = await prisma.market.create({
    data:
      type === "MULTI"
        ? {
            title,
            description,
            type,
            category,
            startDate,
            endDate,
            options: { create: optionLabels!.map((label, i) => ({ label, sortOrder: i })) },
          }
        : {
            title,
            description,
            yesDescription,
            noDescription,
            category,
            startDate,
            endDate,
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
    await createOnChainMarket(market.id, type, market.options.length);
  } catch (err) {
    console.error(`Could not create on-chain market ${market.id}:`, err);
    await prisma.market.delete({ where: { id: market.id } });
    return { ok: false, status: 502, error: revertReason(err) ?? "Could not create the on-chain market" };
  }

  return { ok: true, market };
}
