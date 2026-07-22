"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch, errorMessage } from "@/lib/api";
import { frT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { useConfirm } from "@/lib/confirm-context";
import type { DiagnosticsReport } from "@/lib/types";

const RETRY_DELAY_MS = 3000;
const MAX_AUTO_RETRIES = 10;

function Section({
  title,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {title} <span className="font-mono text-sm font-normal text-muted">({count})</span>
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {count === 0 ? <p className="text-sm text-yes">✓ {emptyLabel}</p> : children}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-paper transition-colors hover:border-brand disabled:opacity-50"
    >
      {busy ? "…" : label}
    </button>
  );
}

export default function AdminDiagnosticsPage() {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingForChain, setWaitingForChain] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef<() => void>(() => {});

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<DiagnosticsReport>("/diagnostics", { token })
      .then((data) => {
        retryCount.current = 0;
        setWaitingForChain(false);
        setError(null);
        setReport(data);
      })
      .catch((err) => {
        const retryable = err instanceof ApiError && err.status === 503;
        if (retryable && retryCount.current < MAX_AUTO_RETRIES) {
          retryCount.current += 1;
          setWaitingForChain(true);
          setError(null);
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => loadRef.current(), RETRY_DELAY_MS);
          return;
        }
        setWaitingForChain(false);
        setError(errorMessage(err, frT));
      });
  }, [token]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    load();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [load]);

  async function withConfirmation(message: string, action: () => Promise<unknown>) {
    setActionError(null);
    const ok = await confirm({
      title: "Action blockchain",
      message,
      confirmLabel: "Confirmer",
    });
    if (!ok) return;
    try {
      await action();
      load();
    } catch (err) {
      setActionError(errorMessage(err, frT));
    }
  }

  if (waitingForChain) {
    return (
      <div className="rounded-lg border border-brand/30 bg-brand-soft px-3.5 py-2.5 text-sm text-brand">
        Blockchain locale en cours de démarrage… nouvel essai dans quelques secondes.
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">
        <p>{error}</p>
        <button
          onClick={() => {
            retryCount.current = 0;
            load();
          }}
          className="rounded-full border border-no/40 px-3.5 py-1.5 text-xs font-medium text-no transition-colors hover:border-no"
        >
          Réessayer
        </button>
      </div>
    );
  }
  if (!report) {
    return <p className="py-8 text-center text-sm text-muted">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {actionError && (
        <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{actionError}</p>
      )}

      <Section title="Marchés désynchronisés" count={report.unsyncedMarkets.length} emptyLabel="Tous les marchés ouverts existent bien sur la blockchain.">
        {report.unsyncedMarkets.map((market) => (
          <div key={market.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div>
              <p className="text-sm font-medium text-paper">{market.title}</p>
              <p className="text-xs text-no">Existe en base, introuvable sur la blockchain</p>
            </div>
            <ActionButton
              label="Recréer on-chain"
              onClick={() =>
                withConfirmation(
                  `Recréer le marché « ${market.title} » sur la blockchain ?`,
                  () => apiFetch(`/diagnostics/resync-market/${market.id}`, { method: "POST", token }),
                )
              }
            />
          </div>
        ))}
      </Section>

      <Section title="Paris bloqués" count={report.stuckBets.length} emptyLabel="Tous les paris résolus ont un gain calculé.">
        {report.stuckBets.map((bet) => (
          <div key={bet.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div>
              <p className="text-sm font-medium text-paper">
                {bet.user.username} — {Number(bet.amount).toFixed(2)} € sur {bet.market.title}
              </p>
              <p className="text-xs text-no">Marché résolu, mais gain jamais calculé</p>
            </div>
            <ActionButton
              label="Resynchroniser le gain"
              onClick={() =>
                withConfirmation(
                  `Resynchroniser les gains pour « ${bet.market.title} » ?`,
                  () =>
                    apiFetch(`/markets/${bet.market.id}/resolve`, {
                      method: "POST",
                      token,
                      body:
                        bet.market.type === "MULTI"
                          ? { optionId: bet.market.resolvedOptionId }
                          : { outcome: bet.market.resolvedOutcome },
                    }),
                )
              }
            />
          </div>
        ))}
      </Section>

      <Section title="Soldes désynchronisés" count={report.balanceDrift.length} emptyLabel="Tous les soldes correspondent à la blockchain.">
        {report.balanceDrift.map((drift) => (
          <div key={drift.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div>
              <p className="text-sm font-medium text-paper">{drift.username}</p>
              <p className="font-mono text-xs text-muted">
                base : {drift.dbBalance.toFixed(2)} € · chaîne : {drift.onChainBalance.toFixed(2)} €
              </p>
            </div>
            <ActionButton
              label="Resynchroniser le solde"
              onClick={() =>
                withConfirmation(
                  `Aligner le solde de « ${drift.username} » sur la blockchain ?`,
                  () => apiFetch(`/diagnostics/resync-balance/${drift.id}`, { method: "POST", token }),
                )
              }
            />
          </div>
        ))}
      </Section>
    </div>
  );
}
