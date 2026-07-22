import { apiFetch } from "@/lib/api";
import type { Market } from "@/lib/types";
import { MarchesContent } from "@/components/marches-content";

type SearchParams = { category?: string; status?: string; search?: string; sort?: string };

async function getMarkets(params: SearchParams): Promise<Market[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  const qs = query.toString();
  const data = await apiFetch<{ markets: Market[] }>(`/markets${qs ? `?${qs}` : ""}`);
  return data.markets;
}

export default async function MarchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const markets = await getMarkets(params);
  return <MarchesContent markets={markets} params={params} />;
}
