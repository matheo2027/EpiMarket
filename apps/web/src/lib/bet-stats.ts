import type { Bet, MarketCategory } from "@/lib/types";

export type CategoryStat = {
  category: MarketCategory;
  wagered: number;
  net: number;
  count: number;
};

export type PnlPoint = {
  date: string;
  cumulativePnl: number;
};

export type BetStats = {
  winRate: number | null;
  totalWagered: number;
  totalWon: number;
  netPnl: number;
  exposure: number;
  resolvedCount: number;
  categoryBreakdown: CategoryStat[];
  history: PnlPoint[];
};

function isWithdrawn(bet: Bet): boolean {
  return bet.withdrawnAt !== null;
}

function isResolved(bet: Bet): boolean {
  return bet.market?.status === "RESOLVED" && !isWithdrawn(bet);
}

function isWin(bet: Bet): boolean {
  return bet.payout !== null && Number(bet.payout) > 0;
}

export function computeBetStats(bets: Bet[]): BetStats {
  const resolved = bets.filter(isResolved).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  // A withdrawn bet already got its stake back — it's neither ongoing exposure
  // nor a resolved win/loss, so it's excluded from both buckets.
  const ongoing = bets.filter((b) => !isResolved(b) && !isWithdrawn(b));

  const wins = resolved.filter(isWin).length;
  const winRate = resolved.length > 0 ? wins / resolved.length : null;

  const totalWagered = resolved.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalWon = resolved.reduce((sum, b) => sum + (b.payout !== null ? Number(b.payout) : 0), 0);
  const netPnl = totalWon - totalWagered;

  const exposure = ongoing.reduce((sum, b) => sum + Number(b.amount), 0);

  const byCategory = new Map<MarketCategory, CategoryStat>();
  for (const bet of resolved) {
    const category = bet.market?.category;
    if (!category) continue;
    const entry = byCategory.get(category) ?? { category, wagered: 0, net: 0, count: 0 };
    entry.wagered += Number(bet.amount);
    entry.net += (bet.payout !== null ? Number(bet.payout) : 0) - Number(bet.amount);
    entry.count += 1;
    byCategory.set(category, entry);
  }
  const categoryBreakdown = [...byCategory.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const history: PnlPoint[] = [];
  if (resolved.length > 0) {
    history.push({ date: resolved[0].createdAt, cumulativePnl: 0 });
    let running = 0;
    for (const bet of resolved) {
      running += (bet.payout !== null ? Number(bet.payout) : 0) - Number(bet.amount);
      history.push({ date: bet.createdAt, cumulativePnl: running });
    }
  }

  return {
    winRate,
    totalWagered,
    totalWon,
    netPnl,
    exposure,
    resolvedCount: resolved.length,
    categoryBreakdown,
    history,
  };
}
