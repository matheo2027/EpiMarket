"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { frT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { truncateHash } from "@/lib/format";
import { optionTone } from "@/lib/option-tones";
import type { Bet } from "@/lib/types";

function formatDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminBetsPage() {
  const { token } = useAuth();
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ bets: Bet[] }>("/bets?all=true", { token })
      .then((data) => setBets(data.bets))
      .catch((err) => setError(errorMessage(err, frT)));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{bets?.length ?? "…"} pari(s)</p>

      {error && <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>}

      <div className="flex flex-col gap-3">
        {bets?.map((bet) => {
          const isMulti = bet.side === null;
          const sideColor = isMulti
            ? optionTone(bet.option?.sortOrder ?? 0).text
            : bet.side === "YES"
              ? "text-yes"
              : "text-no";
          const sideLabel = isMulti ? (bet.option?.label ?? "—") : bet.side === "YES" ? "OUI" : "NON";
          const payout = bet.payout !== null ? Number(bet.payout) : null;

          return (
            <div
              key={bet.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-semibold ${sideColor}`}>{sideLabel}</span>
                  <span className="text-xs text-muted">{bet.user?.username ?? bet.userId}</span>
                </div>
                <p className="text-sm text-paper">{bet.market?.title ?? "Marché"}</p>
                <p className="font-mono text-xs text-muted">{formatDate(bet.createdAt)}</p>
                {bet.txHash && (
                  <p className="font-mono text-[11px] text-muted" title={bet.txHash}>
                    tx {truncateHash(bet.txHash)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-6 font-mono text-sm tabular-nums">
                <div>
                  <p className="text-xs text-muted">Mise</p>
                  <p className="text-paper">{Number(bet.amount).toFixed(2)} €</p>
                </div>
                <div>
                  <p className="text-xs text-muted">{payout === null ? "Statut" : "Gain"}</p>
                  <p className={payout === null ? "text-muted" : payout > 0 ? "text-yes" : "text-no"}>
                    {payout === null ? "En attente" : `${payout.toFixed(2)} €`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {bets?.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucun pari pour l&apos;instant.</p>}
      </div>
    </div>
  );
}
