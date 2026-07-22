"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

export default function InscriptionPage() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, username, password);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.registerTitle")}</h1>
      <p className="mt-2 text-sm text-muted">
        {t("auth.registerSubtitle", { amount: "1000 €" })}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{t("auth.email")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{t("auth.username")}</span>
          <input
            type="text"
            required
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{t("auth.password")}</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand"
          />
          <span className="text-xs text-muted">{t("auth.passwordHint")}</span>
        </label>

        {error && (
          <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
        >
          {submitting ? t("auth.submittingRegister") : t("auth.submitRegister")}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/connexion" className="text-brand hover:underline">
          {t("auth.loginLink")}
        </Link>
      </p>
    </div>
  );
}
