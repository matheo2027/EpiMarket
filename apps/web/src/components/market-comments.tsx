"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { localeFor } from "@/lib/i18n";
import type { Comment } from "@/lib/types";

export function MarketComments({ marketId, initialComments }: { marketId: string; initialComments: Comment[] }) {
  const { user, token } = useAuth();
  const { language, t } = useLanguage();
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(localeFor(language), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<{ comment: Comment }>(`/markets/${marketId}/comments`, {
        method: "POST",
        token,
        body: { content },
      });
      setComments((prev) => [data.comment, ...prev]);
      setContent("");
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    setError(null);
    try {
      await apiFetch(`/markets/${marketId}/comments/${commentId}`, { method: "DELETE", token });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <div className="border-t border-line pt-6">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {t("comments.title")} <span className="font-mono text-sm font-normal text-muted">({comments.length})</span>
      </h2>

      {user ? (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
          <textarea
            required
            rows={2}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("comments.placeholder")}
            className="rounded-lg border border-line bg-ink px-3.5 py-2.5 text-sm text-paper outline-none focus-visible:border-brand"
          />
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-full bg-paper px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
          >
            {submitting ? t("comments.sending") : t("comments.publish")}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">
          <Link href="/connexion" className="text-brand hover:underline">
            {t("comments.loginPrompt")}
          </Link>
          {t("comments.loginSuffix")}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-no">{error}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {comments.length === 0 && <p className="text-sm text-muted">{t("comments.noComments")}</p>}
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-paper">{comment.user.username}</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs text-muted">{formatDate(comment.createdAt)}</p>
                {user && (user.id === comment.userId || user.role === "ADMIN") && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-muted transition-colors hover:text-no"
                  >
                    {t("comments.delete")}
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-paper">{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
