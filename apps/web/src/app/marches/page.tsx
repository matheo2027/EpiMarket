import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CATEGORY_LABELS, type Market, type MarketCategory } from "@/lib/types";
import { MarketCard } from "@/components/market-card";

type SearchParams = { category?: string; status?: string };

async function getMarkets(params: SearchParams): Promise<Market[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.status) query.set("status", params.status);
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
  const qs = query.toString();
  return `/marches${qs ? `?${qs}` : ""}`;
}

function pillClass(active: boolean) {
  return `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-paper"
  }`;
}

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

      <div className="mt-6 flex flex-wrap items-center gap-2">
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

      {markets.length === 0 ? (
        <p className="mt-16 text-center text-muted">Aucun marché ne correspond à ces filtres pour l&apos;instant.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
