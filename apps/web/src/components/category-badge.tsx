import { CATEGORY_LABELS, type MarketCategory } from "@/lib/types";

export function CategoryBadge({ category }: { category: MarketCategory }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface-raised px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-muted">
      {CATEGORY_LABELS[category]}
    </span>
  );
}
