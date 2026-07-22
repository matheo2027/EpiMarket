"use client";

import type { MarketCategory } from "@/lib/types";
import { categoryKey } from "@/lib/i18n";
import { useLanguage } from "@/lib/language-context";

export function CategoryBadge({ category }: { category: MarketCategory }) {
  const { t } = useLanguage();
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface-raised px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-muted">
      {t(categoryKey(category))}
    </span>
  );
}
