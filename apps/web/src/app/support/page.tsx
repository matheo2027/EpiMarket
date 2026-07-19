"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type SubmitEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Ticket } from "@/lib/types";
import { TICKET_STATUS_LABELS } from "@/lib/types";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function statusTone(status: Ticket["status"]) {
  if (status === "RESOLVED") return "text-yes";
  if (status === "IN_PROGRESS") return "text-brand";
  return "text-muted";
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-paper">{ticket.subject}</p>
        <span className={`font-mono text-xs font-semibold ${statusTone(ticket.status)}`}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </span>
      </div>
      <p className="text-sm text-muted">{ticket.message}</p>
      {ticket.adminNote && (
        <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-muted">
          <span className="font-semibold text-paper">Réponse admin : </span>
          {ticket.adminNote}
        </p>
      )}
      <p className="font-mono text-xs text-muted">{formatDate(ticket.createdAt)}</p>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageContent />
    </Suspense>
  );
}

function SupportPageContent() {
  const { user, token, loading } = useAuth();
  const searchParams = useSearchParams();

  const [subject, setSubject] = useState(() => (searchParams.get("txHash") ? "Problème avec un pari" : ""));
  const [message, setMessage] = useState(() => {
    const txHash = searchParams.get("txHash");
    return txHash ? `Mon pari a été placé on-chain (tx ${txHash}) mais n'apparaît pas dans mon portefeuille.` : "";
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  const loadTickets = useCallback(() => {
    if (!token) return;
    apiFetch<{ tickets: Ticket[] }>("/tickets", { token })
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(errorMessage(err)));
  }, [token]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await apiFetch<{ ticket: Ticket }>("/tickets", {
        method: "POST",
        token,
        body: {
          subject,
          message,
          txHash: searchParams.get("txHash") ?? undefined,
          marketId: searchParams.get("marketId") ?? undefined,
        },
      });
      setSuccess("Ticket envoyé, un admin va le traiter.");
      setSubject("");
      setMessage("");
      loadTickets();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-muted">
          <Link href="/connexion" className="text-brand hover:underline">
            Connectez-vous
          </Link>{" "}
          pour signaler un problème.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Support</h1>
      <p className="mt-2 text-sm text-muted">Un problème de solde, un pari qui n&apos;apparaît pas ? Décrivez-le ici.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Sujet</span>
          <input
            type="text"
            required
            minLength={3}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-line bg-ink px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Message</span>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="resize-none rounded-lg border border-line bg-ink px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand"
          />
        </label>

        {error && <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>}
        {success && (
          <p className="rounded-lg border border-yes/30 bg-yes-soft px-3.5 py-2.5 text-sm text-yes">{success}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
        >
          {submitting ? "Envoi…" : "Envoyer"}
        </button>
      </form>

      <h2 className="mt-10 font-display text-lg font-semibold tracking-tight">Mes tickets</h2>
      <div className="mt-4 flex flex-col gap-3">
        {tickets === null && <p className="py-8 text-center text-sm text-muted">Chargement…</p>}
        {tickets?.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucun ticket pour l&apos;instant.</p>}
        {tickets?.map((ticket) => (
          <TicketRow key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  );
}
