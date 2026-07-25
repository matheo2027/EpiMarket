import { env } from "./env.js";
import { createApiClient } from "./httpClient.js";

export type MarketProposal = {
  id: string;
  title: string;
  description: string;
  type: "BINARY" | "MULTI";
  yesDescription: string | null;
  noDescription: string | null;
  optionLabels: string[];
  category: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
  discordMessageId: string | null;
  discordChannelId: string | null;
  proposer?: { id: string; username: string };
};

// Reads env.apiBaseUrl/internalApiSecret lazily on each call (not once at module
// load) — matches env.ts's own lazy-getter design, which defers the "not set"
// error until something actually tries to talk to the API.
function request<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  return createApiClient(env.apiBaseUrl, env.internalApiSecret)<T>(path, options);
}

export function listPendingUnnotified(): Promise<{ proposals: MarketProposal[] }> {
  return request("/market-proposals/pending-unnotified");
}

export function listDecidedUnsynced(): Promise<{ proposals: MarketProposal[] }> {
  return request("/market-proposals/decided-unsynced");
}

export function markNotified(id: string, discordMessageId: string, discordChannelId: string): Promise<void> {
  return request(`/market-proposals/${id}/notify`, { method: "PATCH", body: { discordMessageId, discordChannelId } });
}

export function markSynced(id: string): Promise<void> {
  return request(`/market-proposals/${id}/sync`, { method: "PATCH" });
}

export function approveProposal(id: string, discordUser?: string): Promise<{ proposal: MarketProposal }> {
  return request(`/market-proposals/${id}/approve`, { method: "POST", body: { discordUser } });
}

export function rejectProposal(id: string, discordUser?: string): Promise<{ proposal: MarketProposal }> {
  return request(`/market-proposals/${id}/reject`, { method: "POST", body: { discordUser } });
}
