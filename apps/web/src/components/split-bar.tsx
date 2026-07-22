"use client";

import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/animated-number";
import { useLanguage } from "@/lib/language-context";

type SplitBarProps = {
  yesPrice: number;
  size?: "sm" | "lg";
  animateIn?: boolean;
};

export function SplitBar({ yesPrice, size = "sm", animateIn = false }: SplitBarProps) {
  const { t } = useLanguage();
  const targetYesPct = Math.round(yesPrice * 100);
  const [animatedYesPct, setAnimatedYesPct] = useState(50);

  useEffect(() => {
    if (!animateIn) return;
    const raf = requestAnimationFrame(() => setAnimatedYesPct(targetYesPct));
    return () => cancelAnimationFrame(raf);
  }, [targetYesPct, animateIn]);

  const displayYesPct = animateIn ? animatedYesPct : targetYesPct;

  const noPct = 100 - displayYesPct;
  const barHeight = size === "lg" ? "h-4" : "h-2";
  const labelSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <div className="w-full">
      <div className={`flex w-full overflow-hidden rounded-full bg-line ${barHeight}`}>
        <div
          className="bg-yes shadow-[0_0_16px_var(--yes)] transition-[width] duration-700 ease-out"
          style={{ width: `${displayYesPct}%` }}
        />
        <div
          className="bg-no shadow-[0_0_16px_var(--no)] transition-[width] duration-700 ease-out"
          style={{ width: `${noPct}%` }}
        />
      </div>
      <div className={`mt-1.5 flex items-center justify-between font-mono tabular-nums ${labelSize}`}>
        <span className="text-yes">
          {t("betForm.yes")} <AnimatedNumber value={targetYesPct} format={(n) => `${Math.round(n)}%`} />
        </span>
        <span className="text-no">
          {t("betForm.no")} <AnimatedNumber value={100 - targetYesPct} format={(n) => `${Math.round(n)}%`} />
        </span>
      </div>
    </div>
  );
}
