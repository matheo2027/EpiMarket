"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { apiFetch, errorMessage } from "@/lib/api";
import { categoryKey, localeFor, marketProposalStatusKey } from "@/lib/i18n";
import { marketProposalStatusTone, type MarketProposal } from "@/lib/types";
import { MarketForm, type MarketFormValues } from "@/components/market-form";

function ProposalRow({ proposal }: { proposal: MarketProposal }) {
  const { language, t } = useLanguage();
  const formattedDate = new Date(proposal.createdAt).toLocaleDateString(localeFor(language), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-paper">{proposal.title}</p>
        <span className={`font-mono text-xs font-semibold ${marketProposalStatusTone(proposal.status)}`}>
          {t(marketProposalStatusKey(proposal.status))}
        </span>
      </div>
      <p className="text-sm text-muted">{proposal.description}</p>
      <p className="text-xs text-muted">{t(categoryKey(proposal.category))}</p>
      {proposal.adminNote && (
        <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-muted">
          <span className="font-semibold text-paper">{t("proposer.adminNote")}</span>
          {proposal.adminNote}
        </p>
      )}
      <p className="font-mono text-xs text-muted">{formattedDate}</p>
    </div>
  );
}

export default function ProposerPage() {
  const { user, token, loading } = useAuth();
  const { t } = useLanguage();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [proposals, setProposals] = useState<MarketProposal[] | null>(null);

  const loadProposals = useCallback(() => {
    if (!token) return;
    apiFetch<{ proposals: MarketProposal[] }>("/market-proposals", { token })
      .then((data) => setProposals(data.proposals))
      .catch((err) => setError(errorMessage(err, t)));
  }, [token, t]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  async function handleSubmit(values: MarketFormValues) {
    setError(null);
    setSuccess(null);
    const data = await apiFetch<{ proposal: MarketProposal }>("/market-proposals", {
      method: "POST",
      token,
      body: {
        ...values,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
      },
    });
    setSuccess(t("proposer.proposalSent"));
    setProposals((prev) => [data.proposal, ...(prev ?? [])]);
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-muted">
          <Link href="/connexion" className="text-brand hover:underline">
            {t("proposer.loginPrompt")}
          </Link>
          {t("proposer.loginSuffix")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("proposer.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("proposer.subtitle")}</p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <MarketForm
          initialValues={{
            title: "",
            description: "",
            type: "BINARY",
            yesDescription: "",
            noDescription: "",
            options: ["", "", "", "Autre"],
            category: "OTHER",
            startDate: "",
            endDate: "",
          }}
          submitLabel={t("proposer.submit")}
          onSubmit={handleSubmit}
          allowTypeChange
          allowOptionCountChange
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>
      )}
      {success && (
        <p className="mt-4 rounded-lg border border-yes/30 bg-yes-soft px-3.5 py-2.5 text-sm text-yes">{success}</p>
      )}

      <h2 className="mt-10 font-display text-lg font-semibold tracking-tight">{t("proposer.myProposals")}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {proposals === null && <p className="py-8 text-center text-sm text-muted">{t("common.loading")}</p>}
        {proposals?.length === 0 && <p className="py-8 text-center text-sm text-muted">{t("proposer.noProposals")}</p>}
        {proposals?.map((proposal) => (
          <ProposalRow key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  );
}
