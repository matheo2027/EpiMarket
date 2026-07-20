import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CATEGORY_LABELS, type Market, type MarketCategory } from "@/lib/types";
import { MarketGrid } from "@/components/market-grid";

type SearchParams = { category?: string; status?: string; search?: string; sort?: string };

const SORTS: Record<string, string> = {
  recent: "Plus récents",
  volume: "Volume",
  closing: "Clôture proche",
};

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

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MarketCategory[];

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

export default async function MarchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const markets = await getMarkets(params);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Marchés</h1>
      <p className="mt-2 text-sm text-muted">
        {markets.length} marché{markets.length > 1 ? "s" : ""}
      </p>

      <form action="/marches" method="get" className="mt-6 flex flex-wrap items-center gap-2">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.category && <input type="hidden" name="category" value={params.category} />}
        <input
          type="text"
          name="search"
          defaultValue={params.search ?? ""}
          placeholder="Rechercher un marché…"
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
          Filtrer
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={filterHref(params, { status: undefined })} className={pillClass(!params.status)}>
          Tous
        </Link>
        <Link href={filterHref(params, { status: "OPEN" })} className={pillClass(params.status === "OPEN")}>
          Ouverts
        </Link>
        <Link href={filterHref(params, { status: "RESOLVED" })} className={pillClass(params.status === "RESOLVED")}>
          Résolus
        </Link>
        <span className="mx-1 h-4 w-px bg-line" />
        <Link href={filterHref(params, { category: undefined })} className={pillClass(!params.category)}>
          Toutes catégories
        </Link>
        {CATEGORIES.map((cat) => (
          <Link key={cat} href={filterHref(params, { category: cat })} className={pillClass(params.category === cat)}>
            {CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </div>

      <MarketGrid markets={markets} />
    </div>
  );
}
