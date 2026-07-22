"use client";

import { optionTone } from "@/lib/option-tones";
import { useLanguage } from "@/lib/language-context";
import type { MarketOption } from "@/lib/types";

export function OptionsBar({
  options,
  resolvedOptionId,
  compact = false,
}: {
  options: MarketOption[];
  resolvedOptionId?: string | null;
  compact?: boolean;
}) {
  const { tp } = useLanguage();
  const sorted = [...options].sort((a, b) => a.sortOrder - b.sortOrder);
  const visible = compact ? sorted.slice(0, 4) : sorted;
  const hiddenCount = sorted.length - visible.length;

  return (
    <div className="flex flex-col gap-2.5">
      {visible.map((option) => {
        const tone = optionTone(option.sortOrder);
        const pct = Math.round(option.price * 100);
        const isWinner = resolvedOptionId === option.id;
        return (
          <div key={option.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className={`truncate text-sm ${isWinner ? `font-semibold ${tone.text}` : "text-paper"}`}>
                {option.label}
                {isWinner && " ✓"}
              </span>
              <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${tone.text}`}>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone.bg}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      {hiddenCount > 0 && <p className="font-mono text-xs text-muted">{tp("optionsBar.moreOptions", hiddenCount)}</p>}
    </div>
  );
}
