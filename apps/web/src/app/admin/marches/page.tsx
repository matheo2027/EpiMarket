"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirm } from "@/lib/confirm-context";
import type { Market } from "@/lib/types";
import { CategoryBadge } from "@/components/category-badge";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminMarketsPage() {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveSelection, setResolveSelection] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    apiFetch<{ markets: Market[] }>("/markets")
      .then((data) => setMarkets(data.markets))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleResolve(market: Market, outcome: "YES" | "NO") {
    const ok = await confirm({
      title: "Conclure le marché",
      message: `Conclure « ${market.title} » sur ${outcome === "YES" ? "OUI" : "NON"} ? Cette action règle immédiatement les gains et est irréversible.`,
      confirmLabel: "Conclure",
      danger: true,
    });
    if (!ok) return;
    setBusyId(market.id);
    setError(null);
    try {
      await apiFetch(`/markets/${market.id}/resolve`, { method: "POST", token, body: { outcome } });
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolveOption(market: Market) {
    const optionId = resolveSelection[market.id] ?? market.options?.[0]?.id;
    if (!optionId) return;
    const label = market.options?.find((o) => o.id === optionId)?.label ?? "";
    const ok = await confirm({
      title: "Conclure le marché",
      message: `Conclure « ${market.title} » sur « ${label} » ? Cette action règle immédiatement les gains et est irréversible.`,
      confirmLabel: "Conclure",
      danger: true,
    });
    if (!ok) return;
    setBusyId(market.id);
    setError(null);
    try {
      await apiFetch(`/markets/${market.id}/resolve`, { method: "POST", token, body: { optionId } });
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(market: Market) {
    const ok = await confirm({
      title: "Supprimer le marché",
      message: `Supprimer « ${market.title} » ? Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setBusyId(market.id);
    setError(null);
    try {
      await apiFetch(`/markets/${market.id}`, { method: "DELETE", token });
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{markets?.length ?? "…"} marché(s)</p>
        <Link
          href="/admin/marches/nouveau"
          className="rounded-full bg-paper px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-brand"
        >
          + Nouveau marché
        </Link>
      </div>

      {error && <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>}

      <div className="flex flex-col gap-3">
        {markets?.map((market) => (
          <div key={market.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={market.category} />
                  <span className="font-mono text-xs text-muted">
                    {market.status === "OPEN"
                      ? "Ouvert"
                      : market.type === "MULTI"
                        ? `Résolu · ${market.options?.find((o) => o.id === market.resolvedOptionId)?.label ?? "—"}`
                        : `Résolu · ${market.resolvedOutcome === "YES" ? "OUI" : "NON"}`}
                  </span>
                </div>
                <p className="text-sm font-medium text-paper">{market.title}</p>
                <p className="font-mono text-xs text-muted">
                  {market.type === "MULTI"
                    ? `${market.options?.length ?? 0} options`
                    : `OUI ${Math.round(market.yesPrice * 100)}%`}{" "}
                  · Volume {Number(market.totalVolume).toLocaleString("fr-FR")} € · Clôture{" "}
                  {formatDate(market.endDate)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/marches/${market.id}`}
                  className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-paper transition-colors hover:border-brand"
                >
                  Éditer
                </Link>
                {market.status === "OPEN" && market.type === "MULTI" && (
                  <>
                    <select
                      value={resolveSelection[market.id] ?? market.options?.[0]?.id ?? ""}
                      onChange={(e) => setResolveSelection((s) => ({ ...s, [market.id]: e.target.value }))}
                      className="rounded-full border border-line bg-ink px-3 py-1.5 text-xs text-paper outline-none focus-visible:border-brand"
                    >
                      {market.options?.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={busyId === market.id}
                      onClick={() => handleResolveOption(market)}
                      className="rounded-full border border-brand/40 px-3.5 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand-soft disabled:opacity-50"
                    >
                      Conclure
                    </button>
                  </>
                )}
                {market.status === "OPEN" && market.type === "BINARY" && (
                  <>
                    <button
                      disabled={busyId === market.id}
                      onClick={() => handleResolve(market, "YES")}
                      className="rounded-full border border-yes/40 px-3.5 py-1.5 text-xs font-medium text-yes transition-colors hover:bg-yes-soft disabled:opacity-50"
                    >
                      Conclure OUI
                    </button>
                    <button
                      disabled={busyId === market.id}
                      onClick={() => handleResolve(market, "NO")}
                      className="rounded-full border border-no/40 px-3.5 py-1.5 text-xs font-medium text-no transition-colors hover:bg-no-soft disabled:opacity-50"
                    >
                      Conclure NON
                    </button>
                  </>
                )}
                <button
                  disabled={busyId === market.id}
                  onClick={() => handleDelete(market)}
                  className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-no hover:text-no disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
        {markets?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">Aucun marché pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
