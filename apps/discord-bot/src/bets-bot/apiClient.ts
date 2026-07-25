import { betsEnv } from "./env.js";
import { createApiClient } from "../httpClient.js";

export type BetFeedEntry = {
  id: string;
  side: "YES" | "NO" | null;
  amount: string;
  createdAt: string;
  withdrawnAt: string | null;
  user: { username: string };
  market: { title: string };
  option: { label: string } | null;
};

function request<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  return createApiClient(betsEnv.apiBaseUrl, betsEnv.internalApiSecret)<T>(path, options);
}

export function listUnnotifiedBets(): Promise<{ placed: BetFeedEntry[]; withdrawn: BetFeedEntry[] }> {
  return request("/bets/unnotified");
}

export function markBetNotified(id: string, event: "placed" | "withdrawn"): Promise<void> {
  return request(`/bets/${id}/notify`, { method: "PATCH", body: { event } });
}
