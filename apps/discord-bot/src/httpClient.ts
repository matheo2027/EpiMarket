export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Shared by both bots' apiClient.ts — each just supplies its own base URL/secret (same env vars) and endpoint-specific types. */
export function createApiClient(apiBaseUrl: string, internalApiSecret: string) {
  return async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": internalApiSecret,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiClientError(res.status, (data as { error?: string }).error ?? "Request failed");
    }
    return data as T;
  };
}
