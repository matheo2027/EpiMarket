import { apiFetch } from "@/lib/api";
import type { Market, StatsHistoryPoint } from "@/lib/types";
import { HomeContent } from "@/components/home-content";

async function getOpenMarkets(): Promise<Market[] | null> {
  try {
    const data = await apiFetch<{ markets: Market[] }>("/markets?status=OPEN");
    return data.markets;
  } catch {
    return null;
  }
}

async function getStatsHistory(): Promise<StatsHistoryPoint[]> {
  try {
    const data = await apiFetch<{ history: StatsHistoryPoint[] }>("/markets/stats/history");
    return data.history;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [markets, history] = await Promise.all([getOpenMarkets(), getStatsHistory()]);
  return <HomeContent markets={markets} history={history} />;
}
