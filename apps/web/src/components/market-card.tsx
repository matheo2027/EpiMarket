"use client";

import Link from "next/link";
import { CategoryBadge } from "./category-badge";
import { FavoriteButton } from "./favorite-button";
import { SplitBar } from "./split-bar";
import { OptionsBar } from "./options-bar";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import type { Market } from "@/lib/types";

function formatVolume(v: string) {
  return `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

function statusLabel(
  market: Market,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  tp: (key: string, count: number, vars?: Record<string, string | number>) => string,
): string {
  if (market.status === "RESOLVED") {
    if (market.type === "MULTI") {
      const winner = market.options?.find((o) => o.id === market.resolvedOptionId);
      return winner ? t("marketCard.resolvedWith", { label: winner.label }) : t("marketCard.resolved");
    }
    return market.resolvedOutcome === "YES" ? t("marketCard.resolvedYes") : t("marketCard.resolvedNo");
  }
  const days = Math.ceil((new Date(market.endDate).getTime() - Date.now()) / 86_400_000);
  return days <= 0 ? t("marketCard.closingSoon") : tp("marketCard.daysLeft", days);
}

export function MarketCard({ market }: { market: Market }) {
  const { t, tp } = useLanguage();

  return (
    <Link
      href={`/marches/${market.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand"
    >
      <div className="flex items-center justify-between">
        <CategoryBadge category={market.category} />
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{statusLabel(market, t, tp)}</span>
          <FavoriteButton marketId={market.id} />
        </div>
      </div>
      <h3 className="font-display text-lg font-medium leading-snug text-paper">{market.title}</h3>
      {market.type === "MULTI" ? (
        <OptionsBar options={market.options ?? []} resolvedOptionId={market.resolvedOptionId} compact />
      ) : (
        <SplitBar yesPrice={market.yesPrice} />
      )}
      <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-xs text-muted">
        <span>{t("marketCard.volume", { amount: formatVolume(market.totalVolume) })}</span>
        <span className="text-brand opacity-0 transition-opacity group-hover:opacity-100">{t("marketCard.seeMore")}</span>
      </div>
    </Link>
  );
}
