import { apiErrorKey, type TranslationKey } from "@/lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The API always sends error messages in English (see apps/api). `t` is the
 * current language's translation function (from `useLanguage()`) — admin-only
 * pages that don't wrap themselves in `LanguageProvider`'s consumer chain can
 * still call this without `t` and get the raw English message as a fallback.
 */
export function errorMessage(err: unknown, t?: (key: TranslationKey) => string): string {
  if (!(err instanceof ApiError)) return t ? t("errors.generic") : "Something went wrong.";
  if (!t) return err.message;
  const key = apiErrorKey(err.message);
  return key ? t(key) : err.message;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Something went wrong.");
  }

  return data as T;
}
