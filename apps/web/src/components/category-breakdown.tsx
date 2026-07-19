import type { CategoryStat } from "@/lib/bet-stats";
import { CategoryBadge } from "@/components/category-badge";

function eur(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

export function CategoryBreakdown({ breakdown }: { breakdown: CategoryStat[] }) {
  if (breakdown.length === 0) {
    return <p className="text-sm text-muted">Aucun pari résolu pour le moment.</p>;
  }

  const maxAbs = Math.max(...breakdown.map((b) => Math.abs(b.net)), 1);

  return (
    <div className="flex flex-col gap-2">
      {breakdown.map((entry) => {
        const widthPct = Math.max((Math.abs(entry.net) / maxAbs) * 100, 4);
        const tone = entry.net > 0 ? "bg-yes" : entry.net < 0 ? "bg-no" : "bg-line";
        const textTone = entry.net > 0 ? "text-yes" : entry.net < 0 ? "text-no" : "text-muted";
        return (
          <div
            key={entry.category}
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <CategoryBadge category={entry.category} />
              <span className="font-mono text-xs text-muted">{entry.count} pari(s) · mise {entry.wagered.toLocaleString("fr-FR")} €</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${widthPct}%` }} />
              </div>
              <span className={`font-mono text-sm tabular-nums ${textTone}`}>{eur(entry.net)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
