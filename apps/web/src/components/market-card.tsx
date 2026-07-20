import Link from "next/link";
import { CategoryBadge } from "./category-badge";
import { SplitBar } from "./split-bar";
import { OptionsBar } from "./options-bar";
import type { Market } from "@/lib/types";

function formatVolume(v: string) {
  return `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

function statusLabel(market: Market) {
  if (market.status === "RESOLVED") {
    if (market.type === "MULTI") {
      const winner = market.options?.find((o) => o.id === market.resolvedOptionId);
      return winner ? `Résolu : ${winner.label}` : "Résolu";
    }
    return market.resolvedOutcome === "YES" ? "Résolu : OUI" : "Résolu : NON";
  }
  const days = Math.ceil((new Date(market.endDate).getTime() - Date.now()) / 86_400_000);
  return days <= 0 ? "Clôture imminente" : `${days} j restants`;
}

export function MarketCard({ market }: { market: Market }) {
  return (
    <Link
      href={`/marches/${market.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand"
    >
      <div className="flex items-center justify-between">
        <CategoryBadge category={market.category} />
        <span className="font-mono text-xs text-muted">{statusLabel(market)}</span>
      </div>
      <h3 className="font-display text-lg font-medium leading-snug text-paper">{market.title}</h3>
      {market.type === "MULTI" ? (
        <OptionsBar options={market.options ?? []} resolvedOptionId={market.resolvedOptionId} compact />
      ) : (
        <SplitBar yesPrice={market.yesPrice} />
      )}
      <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-xs text-muted">
        <span>Volume {formatVolume(market.totalVolume)}</span>
        <span className="text-brand opacity-0 transition-opacity group-hover:opacity-100">Voir →</span>
      </div>
    </Link>
  );
}
