"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type SubmitEvent } from "react";
import { apiFetch, errorMessage } from "@/lib/api";

export default function ReinitialiserMotDePassePage() {
  return (
    <Suspense fallback={null}>
      <ReinitialiserMotDePasseContent />
    </Suspense>
  );
}

function ReinitialiserMotDePasseContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: { token, newPassword: password } });
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Réinitialiser le mot de passe</h1>

      {success ? (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-yes/30 bg-yes-soft p-5">
          <p className="text-sm text-paper">Votre mot de passe a été mis à jour.</p>
          <Link href="/connexion" className="text-sm font-medium text-brand hover:underline">
            Se connecter →
          </Link>
        </div>
      ) : !token ? (
        <p className="mt-8 rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">
          Lien de réinitialisation manquant ou invalide.{" "}
          <Link href="/mot-de-passe-oublie" className="underline">
            Demander un nouveau lien
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted">Nouveau mot de passe</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted">Confirmer le mot de passe</span>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {submitting ? "Mise à jour…" : "Réinitialiser"}
          </button>
        </form>
      )}
    </div>
  );
}
