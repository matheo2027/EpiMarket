import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { MarketDetailContent } from "@/components/market-detail-content";
import type { Comment, Market, MarketOption, OptionPricePoint, PricePoint } from "@/lib/types";

async function getMarket(id: string): Promise<Market | null> {
  try {
    const data = await apiFetch<{ market: Market }>(`/markets/${id}`);
    return data.market;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

type PriceHistory =
  | { kind: "binary"; pricePoints: PricePoint[] }
  | { kind: "multi"; options: Pick<MarketOption, "id" | "label" | "sortOrder">[]; optionPricePoints: OptionPricePoint[] };

async function getPriceHistory(id: string, type: Market["type"]): Promise<PriceHistory> {
  if (type === "MULTI") {
    const data = await apiFetch<{
      options: Pick<MarketOption, "id" | "label" | "sortOrder">[];
      optionPricePoints: OptionPricePoint[];
    }>(`/markets/${id}/price-history`);
    return { kind: "multi", ...data };
  }
  const data = await apiFetch<{ pricePoints: PricePoint[] }>(`/markets/${id}/price-history`);
  return { kind: "binary", pricePoints: data.pricePoints };
}

async function getComments(id: string): Promise<Comment[]> {
  const data = await apiFetch<{ comments: Comment[] }>(`/markets/${id}/comments`);
  return data.comments;
}

export default async function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) notFound();

  const [priceHistory, comments] = await Promise.all([getPriceHistory(id, market.type), getComments(id)]);

  return <MarketDetailContent market={market} priceHistory={priceHistory} comments={comments} />;
}
