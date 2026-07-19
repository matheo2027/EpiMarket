"use client";

import { useEffect } from "react";
import { AdminGuideContent, UserGuideContent } from "@/components/help-content";

export function HelpModal({
  open,
  onClose,
  variant,
}: {
  open: boolean;
  onClose: () => void;
  variant: "user" | "admin";
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/70 px-4 py-10 backdrop-blur-sm sm:py-16"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={variant === "admin" ? "Fonctionnement — Administration" : "Comment ça fonctionne"}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">
            {variant === "admin" ? "Fonctionnement — Administration" : "Comment ça fonctionne"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-brand hover:text-paper"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {variant === "admin" ? <AdminGuideContent /> : <UserGuideContent />}
        </div>
      </div>
    </div>
  );
}
