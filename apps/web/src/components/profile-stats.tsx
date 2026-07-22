"use client";

import type { BetStats } from "@/lib/bet-stats";
import { AnimatedNumber } from "@/components/animated-number";
import { useLanguage } from "@/lib/language-context";

function eur(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

export function ProfileStats({ stats }: { stats: BetStats }) {
  const { t, tp } = useLanguage();
  const winRatePct = stats.winRate !== null ? Math.round(stats.winRate * 100) : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-wide text-muted">{t("profile.winRate")}</p>
        <div className="mt-2 font-mono text-2xl tabular-nums text-paper sm:text-3xl">
          {winRatePct !== null ? <AnimatedNumber value={winRatePct} format={(n) => `${Math.round(n)}%`} /> : "—"}
        </div>
        <p className="mt-1 font-mono text-xs text-muted">{tp("profile.resolvedCount", stats.resolvedCount)}</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-wide text-muted">{t("profile.totalWagered")}</p>
        <p className="mt-2 font-mono text-2xl tabular-nums text-paper sm:text-3xl">
          <AnimatedNumber value={stats.totalWagered} format={eur} />
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-wide text-muted">{t("profile.netPnl")}</p>
        <p
          className={`mt-2 font-mono text-2xl tabular-nums sm:text-3xl ${
            stats.netPnl > 0 ? "text-yes" : stats.netPnl < 0 ? "text-no" : "text-paper"
          }`}
        >
          <AnimatedNumber value={stats.netPnl} format={(n) => `${n > 0 ? "+" : ""}${eur(n)}`} />
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-wide text-muted">{t("profile.exposure")}</p>
        <p className="mt-2 font-mono text-2xl tabular-nums text-brand sm:text-3xl">
          <AnimatedNumber value={stats.exposure} format={eur} />
        </p>
      </div>
    </div>
  );
}
