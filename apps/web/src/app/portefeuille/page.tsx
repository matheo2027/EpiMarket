"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Bet } from "@/lib/types";
import { truncateHash } from "@/lib/format";
import { computeBetStats } from "@/lib/bet-stats";
import { ProfileStats } from "@/components/profile-stats";
import { PnlChart } from "@/components/pnl-chart";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { BetRow } from "@/components/bet-row";

type Tab = "ongoing" | "past";

function tabClass(active: boolean) {
  return `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
    active ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-paper"
  }`;
}

export default function PortefeuillePage() {
  const { user, token, loading } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("ongoing");
  const [allBets, setAllBets] = useState<Bet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ bets: Bet[] }>("/bets", { token })
      .then((data) => setAllBets(data.bets))
      .catch((err) => setError(errorMessage(err, t)));
  }, [token, t]);

  const bets = useMemo(() => {
    if (!allBets) return null;
    return allBets.filter((bet) => {
      const settled = bet.market?.status === "RESOLVED" || bet.withdrawnAt !== null;
      return tab === "ongoing" ? !settled : settled;
    });
  }, [allBets, tab]);

  const stats = useMemo(() => (allBets ? computeBetStats(allBets) : null), [allBets]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-muted">
          <Link href="/connexion" className="text-brand hover:underline">
            {t("profile.loginPrompt")}
          </Link>
          {t("profile.loginSuffix")}
        </p>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-muted">{t("profile.adminNoWallet")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("profile.title")}</h1>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">{t("profile.availableBalance")}</p>
        <p className="mt-2 font-mono text-4xl tabular-nums text-paper">{Number(user.walletBalance).toFixed(2)} €</p>
        {user.walletAddress && (
          <p className="mt-3 font-mono text-xs text-muted" title={user.walletAddress}>
            {t("profile.onChainAddress", { address: truncateHash(user.walletAddress) })}
          </p>
        )}
      </div>

      {stats && (
        <div className="mt-8 flex flex-col gap-6">
          <ProfileStats stats={stats} />
          <PnlChart points={stats.history} />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{t("profile.categoryBreakdown")}</h2>
            <div className="mt-3">
              <CategoryBreakdown breakdown={stats.categoryBreakdown} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-2">
        <button onClick={() => setTab("ongoing")} className={tabClass(tab === "ongoing")}>
          {t("profile.tabOngoing")}
        </button>
        <button onClick={() => setTab("past")} className={tabClass(tab === "past")}>
          {t("profile.tabPast")}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {error && <p className="text-sm text-no">{error}</p>}
        {bets === null && !error && <p className="py-8 text-center text-sm text-muted">{t("common.loading")}</p>}
        {bets !== null && bets.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            {tab === "ongoing" ? t("profile.noOngoingBets") : t("profile.noPastBets")}
          </p>
        )}
        {bets?.map((bet) => (
          <BetRow
            key={bet.id}
            bet={bet}
            onWithdrawn={(updated) =>
              setAllBets((prev) => prev?.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)) ?? prev)
            }
          />
        ))}
      </div>
    </div>
  );
}
