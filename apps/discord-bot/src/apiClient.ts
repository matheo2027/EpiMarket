import { env } from "./env.js";

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

class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": env.internalApiSecret,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(res.status, (data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
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
