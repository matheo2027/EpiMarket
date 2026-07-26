import { resolutionsEnv } from "./env.js";
import { createApiClient } from "../httpClient.js";

export type ResolvedMarketFeedEntry = {
  id: string;
  title: string;
  category: string;
  type: "BINARY" | "MULTI";
  resolvedOutcome: "YES" | "NO" | null;
  resolvedOptionId: string | null;
  options: { id: string; label: string }[];
};

function request<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  return createApiClient(resolutionsEnv.apiBaseUrl, resolutionsEnv.internalApiSecret)<T>(path, options);
}

export async function listUnnotifiedResolutions(): Promise<ResolvedMarketFeedEntry[]> {
  const { markets } = await request<{ markets: ResolvedMarketFeedEntry[] }>("/markets/unnotified-resolutions");
  return markets;
}

export function markResolutionNotified(id: string): Promise<void> {
  return request(`/markets/${id}/notify-resolution`, { method: "PATCH" });
}
