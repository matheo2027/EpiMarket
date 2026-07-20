import { apiFetch } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";

function eur(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default async function ClassementPage() {
  const { leaderboard } = await apiFetch<{ leaderboard: LeaderboardEntry[] }>("/users/leaderboard");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Classement</h1>
      <p className="mt-2 text-sm text-muted">
        Les meilleurs parieurs, classés par gain net réalisé sur leurs paris déjà résolus.
      </p>

      {leaderboard.length === 0 ? (
        <p className="mt-16 text-center text-muted">Aucun pari résolu pour l&apos;instant.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-2">
          {leaderboard.map((entry, i) => {
            const rank = i + 1;
            return (
              <div
                key={entry.userId}
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 text-center font-mono text-sm text-muted">{MEDALS[rank] ?? rank}</span>
                  <div>
                    <p className="text-sm font-medium text-paper">{entry.username}</p>
                    <p className="font-mono text-xs text-muted">
                      {Math.round(entry.winRate * 100)}% de réussite · {entry.resolvedCount} pari(s) résolu(s)
                    </p>
                  </div>
                </div>
                <p
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    entry.netPnl > 0 ? "text-yes" : entry.netPnl < 0 ? "text-no" : "text-paper"
                  }`}
                >
                  {eur(entry.netPnl)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
