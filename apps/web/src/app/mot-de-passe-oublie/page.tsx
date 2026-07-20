"use client";

import Link from "next/link";
import { useState, type SubmitEvent } from "react";
import { apiFetch, errorMessage } from "@/lib/api";

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<{ resetToken: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setResetLink(`/reinitialiser-mot-de-passe?token=${data.resetToken}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-muted">
        Entrez votre email pour générer un lien de réinitialisation.
      </p>

      {resetLink ? (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-5">
          <p className="text-sm text-paper">
            Ce projet n&apos;envoie pas de vrais emails : voici directement votre lien de
            réinitialisation (en production, il serait envoyé par email).
          </p>
          <Link href={resetLink} className="break-all text-sm font-medium text-brand hover:underline">
            {resetLink}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
          >
            {submitting ? "Envoi…" : "Générer le lien"}
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-muted">
        <Link href="/connexion" className="text-brand hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
