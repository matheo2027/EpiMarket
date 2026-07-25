"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { frT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { CATEGORY_LABELS, MARKET_PROPOSAL_STATUS_LABELS, marketProposalStatusTone, type MarketProposal } from "@/lib/types";

function formatDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ProposalRow({
  proposal,
  onChanged,
}: {
  proposal: MarketProposal;
  onChanged: (updated: MarketProposal) => void;
}) {
  const { token } = useAuth();
  const [adminNote, setAdminNote] = useState(proposal.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ proposal: MarketProposal; market?: { id: string; title: string } }>(
        `/market-proposals/${proposal.id}/${action}`,
        { method: "POST", token, body: { adminNote } },
      );
      onChanged({ ...data.proposal, market: data.market ?? data.proposal.market ?? null });
    } catch (err) {
      setError(errorMessage(err, frT));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-paper">{proposal.title}</p>
            <span className="text-xs text-muted">{proposal.proposer?.username ?? proposal.proposerId}</span>
            <span className={`font-mono text-xs font-semibold ${marketProposalStatusTone(proposal.status)}`}>
              {MARKET_PROPOSAL_STATUS_LABELS[proposal.status]}
            </span>
          </div>
          <p className="text-sm text-muted">{proposal.description}</p>
          <p className="text-xs text-muted">
            {CATEGORY_LABELS[proposal.category]} · {proposal.type === "MULTI" ? "Options multiples" : "Oui / Non"}
          </p>
          {proposal.type === "MULTI" && (
            <p className="text-xs text-muted">Options : {proposal.optionLabels.join(", ")}</p>
          )}
          {proposal.market && (
            <Link href={`/admin/marches/${proposal.market.id}`} className="text-xs text-brand hover:underline">
              Voir le marché créé →
            </Link>
          )}
          <p className="font-mono text-xs text-muted">{formatDate(proposal.createdAt)}</p>
        </div>
      </div>

      {proposal.status === "PENDING" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-muted">Note admin (optionnelle)</span>
            <input
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus-visible:border-brand"
            />
          </label>
          <button
            disabled={busy}
            onClick={() => decide("approve")}
            className="rounded-full bg-yes px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Approuver
          </button>
          <button
            disabled={busy}
            onClick={() => decide("reject")}
            className="rounded-full border border-no/50 px-3.5 py-2 text-xs font-semibold text-no transition-colors hover:bg-no-soft disabled:opacity-50"
          >
            Rejeter
          </button>
        </div>
      )}
      {error && <p className="text-xs text-no">{error}</p>}
    </div>
  );
}

export default function AdminPropositionsPage() {
  const { token } = useAuth();
  const [proposals, setProposals] = useState<MarketProposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ proposals: MarketProposal[] }>("/market-proposals?all=true", { token })
      .then((data) => setProposals(data.proposals))
      .catch((err) => setError(errorMessage(err, frT)));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function handleChanged(updated: MarketProposal) {
    setProposals((prev) => prev?.map((p) => (p.id === updated.id ? updated : p)) ?? prev);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{proposals?.length ?? "…"} proposition(s)</p>
      {error && <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>}

      <div className="flex flex-col gap-3">
        {proposals?.map((proposal) => (
          <ProposalRow key={proposal.id} proposal={proposal} onChanged={handleChanged} />
        ))}
        {proposals?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">Aucune proposition pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
