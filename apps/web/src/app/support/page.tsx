"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type SubmitEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { apiFetch, errorMessage } from "@/lib/api";
import { localeFor, ticketStatusKey } from "@/lib/i18n";
import type { Ticket } from "@/lib/types";

function statusTone(status: Ticket["status"]) {
  if (status === "RESOLVED") return "text-yes";
  if (status === "IN_PROGRESS") return "text-brand";
  return "text-muted";
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  const { language, t } = useLanguage();
  const formattedDate = new Date(ticket.createdAt).toLocaleDateString(localeFor(language), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-paper">{ticket.subject}</p>
        <span className={`font-mono text-xs font-semibold ${statusTone(ticket.status)}`}>
          {t(ticketStatusKey(ticket.status))}
        </span>
      </div>
      <p className="text-sm text-muted">{ticket.message}</p>
      {ticket.adminNote && (
        <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-muted">
          <span className="font-semibold text-paper">{t("support.adminReply")}</span>
          {ticket.adminNote}
        </p>
      )}
      <p className="font-mono text-xs text-muted">{formattedDate}</p>
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
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const [subject, setSubject] = useState(() => (searchParams.get("txHash") ? t("support.defaultSubject") : ""));
  const [message, setMessage] = useState(() => {
    const txHash = searchParams.get("txHash");
    return txHash ? t("support.defaultMessage", { txHash }) : "";
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  const loadTickets = useCallback(() => {
    if (!token) return;
    apiFetch<{ tickets: Ticket[] }>("/tickets", { token })
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(errorMessage(err, t)));
  }, [token, t]);

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
      setSuccess(t("support.ticketSent"));
      setSubject("");
      setMessage("");
      loadTickets();
    } catch (err) {
      setError(errorMessage(err, t));
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
            {t("support.loginPrompt")}
          </Link>
          {t("support.loginSuffix")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("support.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("support.subtitle")}</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{t("support.subject")}</span>
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
          <span className="text-sm font-medium text-muted">{t("support.message")}</span>
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
          {submitting ? t("support.sending") : t("support.send")}
        </button>
      </form>

      <h2 className="mt-10 font-display text-lg font-semibold tracking-tight">{t("support.myTickets")}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {tickets === null && <p className="py-8 text-center text-sm text-muted">{t("common.loading")}</p>}
        {tickets?.length === 0 && <p className="py-8 text-center text-sm text-muted">{t("support.noTickets")}</p>}
        {tickets?.map((ticket) => (
          <TicketRow key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  );
}
