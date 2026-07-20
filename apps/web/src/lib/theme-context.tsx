"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "epimarket-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start at the SSR-assumed default ("dark") so the very first client
  // render matches the server-rendered HTML exactly (no hydration mismatch).
  // The pre-hydration inline script in layout.tsx has already set the *real*
  // theme on <html data-theme> before paint, so colors are correct from frame
  // one regardless of this state — this only resolves the ThemeToggle's own
  // React-rendered attributes (aria-checked, knob position) to match, once
  // mounted.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const real = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above: must run post-mount to avoid a hydration mismatch
    setThemeState(real);
  }, []);

  function applyTheme(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: applyTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
