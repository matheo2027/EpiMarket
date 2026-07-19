"use client";

import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label="Basculer entre le mode sombre et le mode clair"
      onClick={toggleTheme}
      className="relative flex h-7 w-14 shrink-0 items-center rounded-full border border-line bg-surface-raised px-1 transition-colors"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="absolute left-1.5 h-3 w-3 text-muted"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
        />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="absolute right-1.5 h-3 w-3 text-muted"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
      <span
        aria-hidden="true"
        className={`z-10 h-5 w-5 rounded-full bg-brand shadow-sm transition-transform duration-200 ${
          isLight ? "translate-x-7" : "translate-x-0"
        }`}
      />
    </button>
  );
}
