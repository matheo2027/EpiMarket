"use client";

import Link from "next/link";
import type { Market, MarketCategory } from "@/lib/types";
import { MarketGrid } from "@/components/market-grid";
import { useLanguage } from "@/lib/language-context";
import { categoryKey } from "@/lib/i18n";

type SearchParams = { category?: string; status?: string; search?: string; sort?: string };

const CATEGORIES: MarketCategory[] = ["POLITICS", "SPORTS", "CRYPTO", "ECONOMY", "SCIENCE_TECH", "POP_CULTURE", "OTHER"];

function filterHref(current: SearchParams, patch: Partial<SearchParams>) {
  const next = { ...current, ...patch };
  const query = new URLSearchParams();
  if (next.category) query.set("category", next.category);
  if (next.status) query.set("status", next.status);
  if (next.search) query.set("search", next.search);
  if (next.sort) query.set("sort", next.sort);
  const qs = query.toString();
  return `/marches${qs ? `?${qs}` : ""}`;
}

function pillClass(active: boolean) {
  return `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-paper"
  }`;
}

const inputClass =
  "rounded-full border border-line bg-ink px-3.5 py-1.5 text-sm text-paper outline-none focus-visible:border-brand";

export function MarchesContent({ markets, params }: { markets: Market[]; params: SearchParams }) {
  const { t, tp } = useLanguage();

  const SORTS: Record<string, string> = {
    recent: t("marches.sortRecent"),
    volume: t("marches.sortVolume"),
    closing: t("marches.sortClosing"),
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("marches.title")}</h1>
      <p className="mt-2 text-sm text-muted">{tp("marches.count", markets.length)}</p>

      <form action="/marches" method="get" className="mt-6 flex flex-wrap items-center gap-2">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.category && <input type="hidden" name="category" value={params.category} />}
        <input
          type="text"
          name="search"
          defaultValue={params.search ?? ""}
          placeholder={t("marches.searchPlaceholder")}
          className={`${inputClass} min-w-0 flex-1 sm:flex-none sm:w-64`}
        />
        <select name="sort" defaultValue={params.sort ?? "recent"} className={inputClass}>
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={pillClass(false)}>
          {t("marches.filter")}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={filterHref(params, { status: undefined })} className={pillClass(!params.status)}>
          {t("marches.all")}
        </Link>
        <Link href={filterHref(params, { status: "OPEN" })} className={pillClass(params.status === "OPEN")}>
          {t("marches.open")}
        </Link>
        <Link href={filterHref(params, { status: "RESOLVED" })} className={pillClass(params.status === "RESOLVED")}>
          {t("marches.resolved")}
        </Link>
        <span className="mx-1 h-4 w-px bg-line" />
        <Link href={filterHref(params, { category: undefined })} className={pillClass(!params.category)}>
          {t("marches.allCategories")}
        </Link>
        {CATEGORIES.map((cat) => (
          <Link key={cat} href={filterHref(params, { category: cat })} className={pillClass(params.category === cat)}>
            {t(categoryKey(cat))}
          </Link>
        ))}
      </div>

      <MarketGrid markets={markets} />
    </div>
  );
}
