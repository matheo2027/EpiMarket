"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { truncateHash } from "@/lib/format";
import type { Ticket, TicketStatus } from "@/lib/types";
import { TICKET_STATUS_LABELS } from "@/lib/types";

const inputClass =
  "rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus-visible:border-brand";

function formatDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function TicketRow({ ticket, onChanged }: { ticket: Ticket; onChanged: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [adminNote, setAdminNote] = useState(ticket.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${ticket.id}`, { method: "PATCH", token, body: { status, adminNote } });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-paper">{ticket.subject}</p>
            <span className="text-xs text-muted">{ticket.user?.username ?? ticket.userId}</span>
          </div>
          <p className="text-sm text-muted">{ticket.message}</p>
          {ticket.market && <p className="text-xs text-muted">Marché : {ticket.market.title}</p>}
          {ticket.txHash && (
            <p className="font-mono text-[11px] text-muted" title={ticket.txHash}>
              tx {truncateHash(ticket.txHash)}
            </p>
          )}
          <p className="font-mono text-xs text-muted">{formatDate(ticket.createdAt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Statut</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} className={inputClass}>
            {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted">Note admin</span>
          <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className={inputClass} />
        </label>
        <button
          disabled={busy}
          onClick={handleSave}
          className="rounded-full bg-paper px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
        >
          Enregistrer
        </button>
      </div>
      {error && <p className="text-xs text-no">{error}</p>}
    </div>
  );
}

export default function AdminTicketsPage() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ tickets: Ticket[] }>("/tickets?all=true", { token })
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(errorMessage(err)));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{tickets?.length ?? "…"} ticket(s)</p>
      {error && <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>}

      <div className="flex flex-col gap-3">
        {tickets?.map((ticket) => (
          <TicketRow key={ticket.id} ticket={ticket} onChanged={load} />
        ))}
        {tickets?.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucun ticket pour l&apos;instant.</p>}
      </div>
    </div>
  );
}
