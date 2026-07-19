"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { AdminStats } from "@/lib/types";
import { AnimatedNumber } from "@/components/animated-number";

function eur(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

function Tile({
  label,
  value,
  format = (n: number) => Math.round(n).toLocaleString("fr-FR"),
  tone = "text-brand",
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-mono text-xl tabular-nums sm:text-2xl ${tone}`}>
        <AnimatedNumber value={value} format={format} />
      </p>
    </div>
  );
}

export function AdminStatsBar() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ stats: AdminStats }>("/users/stats", { token })
      .then((data) => setStats(data.stats))
      .catch(() => setStats(null));
  }, [token]);

  if (!stats) return null;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label="Utilisateurs" value={stats.totalUsers} />
      <Tile label="Marchés" value={stats.totalMarkets} />
      <Tile label="Ouverts" value={stats.openMarkets} tone="text-yes" />
      <Tile label="Résolus" value={stats.resolvedMarkets} tone="text-muted" />
      <Tile label="Paris" value={stats.totalBets} />
      <Tile label="Volume total" value={Number(stats.totalVolume)} format={eur} />
    </div>
  );
}
