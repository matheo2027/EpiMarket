"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

export default function ConnexionPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.loginTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("auth.loginSubtitle")}</p>

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
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">{t("auth.password")}</span>
            <Link href="/mot-de-passe-oublie" className="text-xs text-brand hover:underline">
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {submitting ? t("auth.submittingLogin") : t("auth.submitLogin")}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/inscription" className="text-brand hover:underline">
          {t("auth.createAccountLink")}
        </Link>
      </p>
    </div>
  );
}
