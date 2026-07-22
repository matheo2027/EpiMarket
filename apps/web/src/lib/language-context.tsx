"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LANGUAGES, translate, translatePlural, type Language, type TranslationKey } from "./i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  tp: (key: string, count: number, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "epimarket-language";

function isLanguage(value: string | null): value is Language {
  return !!value && (LANGUAGES as string[]).includes(value);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start at "fr" (the SSR-assumed default) so the first client render
  // matches the server-rendered HTML exactly — same hydration-safety pattern
  // as ThemeProvider in theme-context.tsx.
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists client-side, can't move to lazy initial state without a hydration mismatch (see theme-context.tsx)
      setLanguageState(stored);
    }
  }, []);

  function setLanguage(next: Language) {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>) {
    return translate(language, key, vars);
  }

  function tp(key: string, count: number, vars?: Record<string, string | number>) {
    return translatePlural(language, key, count, vars);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tp }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
