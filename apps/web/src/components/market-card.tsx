import Link from "next/link";
import { CategoryBadge } from "./category-badge";
import { SplitBar } from "./split-bar";
import type { Market } from "@/lib/types";

function formatVolume(v: string) {
  return `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

function statusLabel(market: Market) {
  if (market.status === "RESOLVED") {
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
      <SplitBar yesPrice={market.yesPrice} />
      <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-xs text-muted">
        <span>Volume {formatVolume(market.totalVolume)}</span>
        <span className="text-brand opacity-0 transition-opacity group-hover:opacity-100">Voir →</span>
      </div>
    </Link>
  );
}
