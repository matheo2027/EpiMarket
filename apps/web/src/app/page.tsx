import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Market } from "@/lib/types";
import { MarketCard } from "@/components/market-card";
import { CategoryBadge } from "@/components/category-badge";
import { SplitBar } from "@/components/split-bar";

async function getOpenMarkets(): Promise<Market[] | null> {
  try {
    const data = await apiFetch<{ markets: Market[] }>("/markets?status=OPEN");
    return data.markets;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const markets = await getOpenMarkets();

  if (markets === null) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-32 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Epitech Market</h1>
        <p className="mt-4 text-muted">
          Impossible de contacter le serveur pour le moment. Réessayez dans un instant.
        </p>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-32 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Epitech Market</h1>
        <p className="mt-4 text-muted">Aucun marché n&apos;est ouvert pour le moment. Revenez bientôt.</p>
      </div>
    );
  }

  const featured = [...markets].sort((a, b) => Number(b.totalVolume) - Number(a.totalVolume))[0];
  const rest = markets.filter((m) => m.id !== featured.id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        href={`/marches/${featured.id}`}
        className="group block rounded-3xl border border-line bg-surface p-8 transition-colors hover:border-brand sm:p-10"
      >
        <div className="flex items-center gap-3">
          <CategoryBadge category={featured.category} />
          <span className="font-mono text-xs uppercase tracking-wide text-muted">Marché du moment</span>
        </div>
        <h1 className="mt-5 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {featured.title}
        </h1>
        <div className="mt-8 max-w-xl">
          <SplitBar yesPrice={featured.yesPrice} size="lg" animateIn />
        </div>
        <div className="mt-6 flex items-center gap-6 font-mono text-xs text-muted">
          <span>Volume {Number(featured.totalVolume).toLocaleString("fr-FR")} €</span>
          <span className="text-brand opacity-0 transition-opacity group-hover:opacity-100">Parier →</span>
        </div>
      </Link>

      {rest.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight">Marchés ouverts</h2>
            <Link href="/marches" className="text-sm text-muted transition-colors hover:text-paper">
              Tout voir →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.slice(0, 6).map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
