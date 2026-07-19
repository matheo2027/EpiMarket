"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Bet } from "@/lib/types";
import { CategoryBadge } from "@/components/category-badge";
import { truncateHash } from "@/lib/format";
import { computeBetStats } from "@/lib/bet-stats";
import { ProfileStats } from "@/components/profile-stats";
import { PnlChart } from "@/components/pnl-chart";
import { CategoryBreakdown } from "@/components/category-breakdown";

type Tab = "ongoing" | "past";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function tabClass(active: boolean) {
  return `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
    active ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-paper"
  }`;
}

function BetRow({ bet }: { bet: Bet }) {
  const market = bet.market;
  const sideColor = bet.side === "YES" ? "text-yes" : "text-no";
  const payout = bet.payout !== null ? Number(bet.payout) : null;

  return (
    <Link
      href={market ? `/marches/${market.id}` : "#"}
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {market && <CategoryBadge category={market.category} />}
          <span className={`font-mono text-xs font-semibold ${sideColor}`}>
            {bet.side === "YES" ? "OUI" : "NON"}
          </span>
        </div>
        <p className="text-sm text-paper">{market?.title ?? "Marché"}</p>
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
    </Link>
  );
}

export default function PortefeuillePage() {
  const { user, token, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("ongoing");
  const [allBets, setAllBets] = useState<Bet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setAllBets(null);
    setError(null);
    apiFetch<{ bets: Bet[] }>("/bets", { token })
      .then((data) => setAllBets(data.bets))
      .catch((err) => setError(errorMessage(err)));
  }, [token]);

  const bets = useMemo(() => {
    if (!allBets) return null;
    return allBets.filter((bet) =>
      tab === "ongoing" ? bet.market?.status === "OPEN" : bet.market?.status === "RESOLVED",
    );
  }, [allBets, tab]);

  const stats = useMemo(() => (allBets ? computeBetStats(allBets) : null), [allBets]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-muted">
          <Link href="/connexion" className="text-brand hover:underline">
            Connectez-vous
          </Link>{" "}
          pour voir votre portefeuille.
        </p>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-muted">Les administrateurs n&apos;ont pas de portefeuille.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Profil</h1>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">Solde disponible</p>
        <p className="mt-2 font-mono text-4xl tabular-nums text-paper">{Number(user.walletBalance).toFixed(2)} €</p>
        {user.walletAddress && (
          <p className="mt-3 font-mono text-xs text-muted" title={user.walletAddress}>
            Adresse on-chain : {truncateHash(user.walletAddress)}
          </p>
        )}
      </div>

      {stats && (
        <div className="mt-8 flex flex-col gap-6">
          <ProfileStats stats={stats} />
          <PnlChart points={stats.history} />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Répartition par catégorie</h2>
            <div className="mt-3">
              <CategoryBreakdown breakdown={stats.categoryBreakdown} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-2">
        <button onClick={() => setTab("ongoing")} className={tabClass(tab === "ongoing")}>
          En cours
        </button>
        <button onClick={() => setTab("past")} className={tabClass(tab === "past")}>
          Passés
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {error && <p className="text-sm text-no">{error}</p>}
        {bets === null && !error && <p className="py-8 text-center text-sm text-muted">Chargement…</p>}
        {bets !== null && bets.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            {tab === "ongoing" ? "Aucun pari en cours." : "Aucun pari passé."}
          </p>
        )}
        {bets?.map((bet) => (
          <BetRow key={bet.id} bet={bet} />
        ))}
      </div>
    </div>
  );
}
