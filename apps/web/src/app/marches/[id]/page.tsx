import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { CategoryBadge } from "@/components/category-badge";
import { FavoriteButton } from "@/components/favorite-button";
import { SplitBar } from "@/components/split-bar";
import { OptionsBar } from "@/components/options-bar";
import { PriceChart } from "@/components/price-chart";
import { OptionsPriceChart } from "@/components/options-price-chart";
import { BetForm } from "@/components/bet-form";
import { MarketComments } from "@/components/market-comments";
import type { Comment, Market, MarketOption, OptionPricePoint, PricePoint } from "@/lib/types";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
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

type PriceHistory =
  | { kind: "binary"; pricePoints: PricePoint[] }
  | { kind: "multi"; options: Pick<MarketOption, "id" | "label" | "sortOrder">[]; optionPricePoints: OptionPricePoint[] };

async function getPriceHistory(id: string, type: Market["type"]): Promise<PriceHistory> {
  if (type === "MULTI") {
    const data = await apiFetch<{
      options: Pick<MarketOption, "id" | "label" | "sortOrder">[];
      optionPricePoints: OptionPricePoint[];
    }>(`/markets/${id}/price-history`);
    return { kind: "multi", ...data };
  }
  const data = await apiFetch<{ pricePoints: PricePoint[] }>(`/markets/${id}/price-history`);
  return { kind: "binary", pricePoints: data.pricePoints };
}

async function getComments(id: string): Promise<Comment[]> {
  const data = await apiFetch<{ comments: Comment[] }>(`/markets/${id}/comments`);
  return data.comments;
}

export default async function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) notFound();

  const [priceHistory, comments] = await Promise.all([getPriceHistory(id, market.type), getComments(id)]);

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
              <FavoriteButton marketId={market.id} />
              {market.status === "RESOLVED" && market.type === "BINARY" && (
                <span className="font-mono text-xs uppercase tracking-wide text-muted">
                  Résolu : {market.resolvedOutcome === "YES" ? "OUI" : "NON"}
                </span>
              )}
              {market.status === "RESOLVED" && market.type === "MULTI" && (
                <span className="font-mono text-xs uppercase tracking-wide text-muted">
                  Résolu : {market.options?.find((o) => o.id === market.resolvedOptionId)?.label ?? "—"}
                </span>
              )}
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {market.title}
            </h1>
            <p className="mt-4 max-w-2xl text-muted">{market.description}</p>
          </div>

          {market.type === "MULTI" ? (
            <div className="rounded-2xl border border-line bg-surface p-5">
              <OptionsBar options={market.options ?? []} resolvedOptionId={market.resolvedOptionId} />
            </div>
          ) : (
            <>
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
            </>
          )}

          {priceHistory.kind === "multi" ? (
            <OptionsPriceChart options={priceHistory.options} optionPricePoints={priceHistory.optionPricePoints} />
          ) : (
            <PriceChart pricePoints={priceHistory.pricePoints} />
          )}

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

          <MarketComments marketId={market.id} initialComments={comments} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <BetForm market={market} />
        </div>
      </div>
    </div>
  );
}
