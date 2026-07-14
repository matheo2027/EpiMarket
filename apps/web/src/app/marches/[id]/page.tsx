import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { CategoryBadge } from "@/components/category-badge";
import { SplitBar } from "@/components/split-bar";
import { PriceChart } from "@/components/price-chart";
import { BetForm } from "@/components/bet-form";
import type { Market, PricePoint } from "@/lib/types";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatVolume(v: string) {
  return `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

async function getMarket(id: string): Promise<Market | null> {
  try {
    const data = await apiFetch<{ market: Market }>(`/markets/${id}`);
    return data.market;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function getPriceHistory(id: string): Promise<PricePoint[]> {
  const data = await apiFetch<{ pricePoints: PricePoint[] }>(`/markets/${id}/price-history`);
  return data.pricePoints;
}

export default async function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) notFound();

  const pricePoints = await getPriceHistory(id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/marches" className="text-sm text-muted transition-colors hover:text-paper">
        ← Marchés
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          <div>
            <div className="flex items-center gap-3">
              <CategoryBadge category={market.category} />
              {market.status === "RESOLVED" && (
                <span className="font-mono text-xs uppercase tracking-wide text-muted">
                  Résolu : {market.resolvedOutcome === "YES" ? "OUI" : "NON"}
                </span>
              )}
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {market.title}
            </h1>
            <p className="mt-4 max-w-2xl text-muted">{market.description}</p>
          </div>

          <SplitBar yesPrice={market.yesPrice} size="lg" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-yes/30 bg-yes-soft p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-yes">Compte comme OUI</p>
              <p className="mt-2 text-sm text-paper">{market.yesDescription}</p>
            </div>
            <div className="rounded-2xl border border-no/30 bg-no-soft p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-no">Compte comme NON</p>
              <p className="mt-2 text-sm text-paper">{market.noDescription}</p>
            </div>
          </div>

          <PriceChart pricePoints={pricePoints} />

          <div className="grid grid-cols-2 gap-4 border-t border-line pt-6 font-mono text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted">Volume total</p>
              <p className="mt-1 tabular-nums text-paper">{formatVolume(market.totalVolume)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Début</p>
              <p className="mt-1 text-paper">{formatDate(market.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Clôture</p>
              <p className="mt-1 text-paper">{formatDate(market.endDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Statut</p>
              <p className="mt-1 text-paper">{market.status === "OPEN" ? "Ouvert" : "Résolu"}</p>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <BetForm market={market} />
        </div>
      </div>
    </div>
  );
}
