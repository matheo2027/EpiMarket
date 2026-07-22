"use client";

import { useId, useMemo, useState, type MouseEvent } from "react";
import type { OptionPricePoint } from "@/lib/types";
import { ChartArrowButton } from "@/components/chart-arrow-button";
import { optionTone } from "@/lib/option-tones";
import { useHoldRepeat } from "@/lib/use-hold-repeat";
import { useLanguage } from "@/lib/language-context";
import { localeFor } from "@/lib/i18n";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 26;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const GRID_LEVELS = [0, 25, 50, 75, 100];

type OptionMeta = { id: string; label: string; sortOrder: number };
type Tick = { t: number; prices: Record<string, number> };

export function OptionsPriceChart({
  options,
  optionPricePoints,
}: {
  options: OptionMeta[];
  optionPricePoints: OptionPricePoint[];
}) {
  const { language, t } = useLanguage();
  const formatDay = (time: number) =>
    new Date(time).toLocaleDateString(localeFor(language), { day: "2-digit", month: "short" });
  const gradientId = useId();
  const sortedOptions = useMemo(() => [...options].sort((a, b) => a.sortOrder - b.sortOrder), [options]);

  const ticks = useMemo<Tick[]>(() => {
    const byTimestamp = new Map<string, Tick>();
    for (const p of optionPricePoints) {
      const t = new Date(p.timestamp).getTime();
      const key = p.timestamp;
      let tick = byTimestamp.get(key);
      if (!tick) {
        tick = { t, prices: {} };
        byTimestamp.set(key, tick);
      }
      tick.prices[p.optionId] = Number(p.price) * 100;
    }
    const sorted = [...byTimestamp.values()].sort((a, b) => a.t - b.t);

    // Bets don't rewrite every option's price point unless that option's pool
    // actually moved in this app's flow — carry the last known value forward
    // so every tick has a value for every option, keeping lines continuous.
    const last: Record<string, number> = {};
    for (const option of sortedOptions) last[option.id] = 100 / sortedOptions.length;
    for (const tick of sorted) {
      for (const option of sortedOptions) {
        if (tick.prices[option.id] === undefined) tick.prices[option.id] = last[option.id];
        else last[option.id] = tick.prices[option.id];
      }
    }
    return sorted;
  }, [optionPricePoints, sortedOptions]);

  const [pinnedIndex, setPinnedIndex] = useState(Math.max(ticks.length - 1, 0));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const stepBack = () => setPinnedIndex((i) => Math.max(i - 1, 0));
  const stepForward = () => setPinnedIndex((i) => Math.min(i + 1, ticks.length - 1));
  const backHold = useHoldRepeat(stepBack);
  const forwardHold = useHoldRepeat(stepForward);

  if (ticks.length < 2) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-line bg-surface text-center">
        <p className="text-sm text-muted">{t("marketDetail.noPriceHistory")}</p>
        <p className="mt-1 text-xs text-muted">{t("marketDetail.beFirstToBet")}</p>
      </div>
    );
  }

  const clampedPinned = Math.min(pinnedIndex, ticks.length - 1);
  const minT = ticks[0].t;
  const maxT = ticks[ticks.length - 1].t;
  const spanT = Math.max(maxT - minT, 1);

  const x = (t: number) => PAD_LEFT + ((t - minT) / spanT) * INNER_WIDTH;
  const y = (v: number) => PAD_TOP + (1 - v / 100) * INNER_HEIGHT;

  const displayIndex = hoverIndex ?? clampedPinned;
  const current = ticks[displayIndex];
  const isLatest = displayIndex === ticks.length - 1;

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const t = minT + ((relX - PAD_LEFT) / INNER_WIDTH) * spanT;
    let nearest = 0;
    let best = Infinity;
    ticks.forEach((p, i) => {
      const d = Math.abs(p.t - t);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {sortedOptions.map((option) => {
            const tone = optionTone(option.sortOrder);
            return (
              <span key={option.id} className="flex items-center gap-1.5 font-mono text-xs">
                <span className={`h-2 w-2 rounded-full ${tone.bg}`} />
                <span className="text-muted">{option.label}</span>
                <span className={`font-semibold tabular-nums ${tone.text}`}>
                  {Math.round(current.prices[option.id] ?? 0)}%
                </span>
              </span>
            );
          })}
        </div>
        <p className="shrink-0 font-mono text-xs text-muted">{isLatest ? t("marketDetail.today") : formatDay(current.t)}</p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 w-full cursor-crosshair touch-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          {sortedOptions.map((option) => {
            const tone = optionTone(option.sortOrder);
            return (
              <linearGradient key={option.id} id={`${gradientId}-${option.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tone.glow} stopOpacity="0.2" />
                <stop offset="100%" stopColor={tone.glow} stopOpacity="0" />
              </linearGradient>
            );
          })}
        </defs>

        {GRID_LEVELS.map((level) => (
          <g key={level}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y(level)}
              y2={y(level)}
              className="stroke-line"
              strokeWidth={1}
              strokeDasharray={level === 50 ? "4 4" : undefined}
            />
            <text x={0} y={y(level) + 3} className="fill-muted font-mono" fontSize={9}>
              {level}
            </text>
          </g>
        ))}

        {sortedOptions.map((option) => {
          const tone = optionTone(option.sortOrder);
          const path = ticks
            .map((tick, i) => `${i === 0 ? "M" : "L"} ${x(tick.t).toFixed(2)} ${y(tick.prices[option.id] ?? 0).toFixed(2)}`)
            .join(" ");
          return <path key={option.id} d={path} fill="none" className={tone.stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${tone.glow})` }} />;
        })}

        <line
          x1={x(current.t)}
          x2={x(current.t)}
          y1={PAD_TOP}
          y2={HEIGHT - PAD_BOTTOM}
          className="stroke-muted"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {sortedOptions.map((option) => {
          const tone = optionTone(option.sortOrder);
          return (
            <circle
              key={option.id}
              cx={x(current.t)}
              cy={y(current.prices[option.id] ?? 0)}
              r={4}
              className={tone.fill}
              style={{ filter: `drop-shadow(0 0 5px ${tone.glow})` }}
            />
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted">
        <span>{formatDay(ticks[0].t)}</span>
        <div className="flex items-center gap-2">
          <ChartArrowButton direction="left" disabled={clampedPinned === 0} holdProps={backHold} />
          <ChartArrowButton direction="right" disabled={clampedPinned === ticks.length - 1} holdProps={forwardHold} />
        </div>
        <span>{formatDay(ticks[ticks.length - 1].t)}</span>
      </div>
    </div>
  );
}
