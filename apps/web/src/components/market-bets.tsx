"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Bet } from "@/lib/types";
import { BetRow } from "@/components/bet-row";

export function MarketBets({ marketId }: { marketId: string }) {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ bets: Bet[] }>(`/bets?marketId=${marketId}`, { token })
      .then((data) => setBets(data.bets))
      .catch((err) => setError(errorMessage(err, t)));
  }, [token, marketId, t]);

  if (!user || user.role === "ADMIN") return null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-base font-semibold tracking-tight">{t("marketDetail.yourBets")}</h2>
      <div className="mt-3 flex flex-col gap-3">
        {error && <p className="text-sm text-no">{error}</p>}
        {bets === null && !error && <p className="text-sm text-muted">{t("common.loading")}</p>}
        {bets !== null && bets.length === 0 && <p className="text-sm text-muted">{t("marketDetail.noBetsHere")}</p>}
        {bets?.map((bet) => (
          <BetRow
            key={bet.id}
            bet={bet}
            linkToMarket={false}
            onWithdrawn={(updated) => {
              setBets((prev) => prev?.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)) ?? prev);
              router.refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}
