"use client";

import { useEffect, useState } from "react";

type SplitBarProps = {
  yesPrice: number;
  size?: "sm" | "lg";
  animateIn?: boolean;
};

export function SplitBar({ yesPrice, size = "sm", animateIn = false }: SplitBarProps) {
  const targetYesPct = Math.round(yesPrice * 100);
  const [displayYesPct, setDisplayYesPct] = useState(animateIn ? 50 : targetYesPct);

  useEffect(() => {
    if (!animateIn) {
      setDisplayYesPct(targetYesPct);
      return;
    }
    const raf = requestAnimationFrame(() => setDisplayYesPct(targetYesPct));
    return () => cancelAnimationFrame(raf);
  }, [targetYesPct, animateIn]);

  const noPct = 100 - displayYesPct;
  const barHeight = size === "lg" ? "h-4" : "h-2";
  const labelSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <div className="w-full">
      <div className={`flex w-full overflow-hidden rounded-full bg-line ${barHeight}`}>
        <div
          className="bg-yes transition-[width] duration-700 ease-out"
          style={{ width: `${displayYesPct}%` }}
        />
        <div
          className="bg-no transition-[width] duration-700 ease-out"
          style={{ width: `${noPct}%` }}
        />
      </div>
      <div className={`mt-1.5 flex justify-between font-mono tabular-nums ${labelSize}`}>
        <span className="text-yes">OUI {targetYesPct}%</span>
        <span className="text-no">NON {100 - targetYesPct}%</span>
      </div>
    </div>
  );
}
