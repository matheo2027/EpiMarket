"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { LANGUAGES, LANGUAGE_LABELS, type Language } from "@/lib/i18n";

const LANGUAGE_CODES: Record<Language, string> = { fr: "FR", en: "EN", es: "ES", de: "DE" };

// Native <select>/<option> popups are drawn by the OS on Windows Chrome and
// largely ignore custom background-color styling (only text color partially
// applies), making a dark-themed option list unreadable — confirmed visually.
// A fully custom dropdown (rendered in the page's own DOM, styled like the
// rest of the app's own modals) sidesteps that browser/OS limitation.
export function LanguageSwitcher({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(lang: Language) {
    setLanguage(lang);
    setOpen(false);
  }

  const isFull = variant === "full";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choisir la langue / Choose language"
        className={
          isFull
            ? "inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-paper"
            : "flex items-center gap-1 rounded-full border border-line bg-surface-raised px-2.5 py-1 text-xs font-medium text-paper transition-colors hover:border-brand"
        }
      >
        {isFull && <span aria-hidden="true">🌐</span>}
        <span>{isFull ? LANGUAGE_LABELS[language] : LANGUAGE_CODES[language]}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-50 mt-1.5 min-w-[8rem] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl ${
            isFull ? "bottom-full mb-1.5 left-0" : "right-0"
          }`}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="option"
              aria-selected={lang === language}
              onClick={() => choose(lang)}
              className={`block w-full px-3.5 py-2 text-left text-sm transition-colors ${
                lang === language ? "bg-brand-soft text-brand" : "text-paper hover:bg-surface-raised"
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
