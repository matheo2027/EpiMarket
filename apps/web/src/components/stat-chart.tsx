"use client";

import { useId, useMemo, useState, type MouseEvent } from "react";
import { AnimatedNumber } from "@/components/animated-number";
import { ChartArrowButton } from "@/components/chart-arrow-button";
import { useHoldRepeat } from "@/lib/use-hold-repeat";

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

export type StatChartPoint = { date: string; value: number };

export type Tone = "brand" | "yes" | "no" | "series-3" | "series-4";

const TONE_CLASSES: Record<Tone, { stroke: string; fill: string; text: string; glow: string }> = {
  brand: { stroke: "stroke-brand", fill: "fill-brand", text: "text-brand", glow: "var(--brand)" },
  yes: { stroke: "stroke-yes", fill: "fill-yes", text: "text-yes", glow: "var(--yes)" },
  no: { stroke: "stroke-no", fill: "fill-no", text: "text-no", glow: "var(--no)" },
  "series-3": {
    stroke: "stroke-series-3",
    fill: "fill-series-3",
    text: "text-series-3",
    glow: "var(--series-3)",
  },
  "series-4": {
    stroke: "stroke-series-4",
    fill: "fill-series-4",
    text: "text-series-4",
    glow: "var(--series-4)",
  },
};

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function StatChart({
  label,
  points,
  tone = "brand",
  format = (n: number) => Math.round(n).toLocaleString("fr-FR"),
}: {
  label: string;
  points: StatChartPoint[];
  tone?: Tone;
  format?: (n: number) => string;
}) {
  const gradientId = useId();
  const [pinnedIndex, setPinnedIndex] = useState(points.length - 1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { xScale, yScale, path, areaPath } = useMemo(() => {
    const values = points.map((p) => p.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const pad = Math.max((max - min) * 0.15, 1);
    const domainMin = min - pad;
    const domainMax = max + pad;
    const domainSpan = Math.max(domainMax - domainMin, 1);

    const x = (i: number) => PAD_LEFT + (points.length <= 1 ? 0 : (i / (points.length - 1)) * INNER_WIDTH);
    const y = (v: number) => PAD_TOP + (1 - (v - domainMin) / domainSpan) * INNER_HEIGHT;

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(" ");
    const area =
      points.length > 0
        ? `${line} L ${x(points.length - 1).toFixed(2)} ${HEIGHT - PAD_BOTTOM} L ${x(0).toFixed(2)} ${HEIGHT - PAD_BOTTOM} Z`
        : "";

    return { xScale: x, yScale: y, path: line, areaPath: area };
  }, [points]);

  const tones = TONE_CLASSES[tone];

  const stepBack = () => setPinnedIndex((i) => Math.max(i - 1, 0));
  const stepForward = () => setPinnedIndex((i) => Math.min(i + 1, points.length - 1));
  const backHold = useHoldRepeat(stepBack);
  const forwardHold = useHoldRepeat(stepForward);

  if (points.length < 2) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-line bg-surface text-center">
        <p className="text-sm text-muted">Pas encore assez de données pour {label.toLowerCase()}.</p>
      </div>
    );
  }

  const displayIndex = hoverIndex ?? pinnedIndex;
  const current = points[displayIndex];
  const isLatest = displayIndex === points.length - 1;

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = (relX - PAD_LEFT) / INNER_WIDTH;
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.min(Math.max(index, 0), points.length - 1));
  }

  function handleMouseLeave() {
    setHoverIndex(null);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">{label}</p>
          <p className={`mt-1 font-mono text-3xl tabular-nums ${tones.text} sm:text-4xl`}>
            <AnimatedNumber value={current.value} format={format} />
          </p>
        </div>
        <p className="font-mono text-xs text-muted">{isLatest ? "aujourd'hui" : formatDay(current.date)}</p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 w-full cursor-crosshair touch-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tones.glow} stopOpacity="0.35" />
            <stop offset="100%" stopColor={tones.glow} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={path}
          fill="none"
          className={tones.stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${tones.glow})` }}
        />

        <line
          x1={xScale(displayIndex)}
          x2={xScale(displayIndex)}
          y1={PAD_TOP}
          y2={HEIGHT - PAD_BOTTOM}
          className="stroke-muted"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <circle
          cx={xScale(displayIndex)}
          cy={yScale(current.value)}
          r={4}
          className={tones.fill}
          style={{ filter: `drop-shadow(0 0 6px ${tones.glow})` }}
        />
      </svg>

      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted">
        <span>{formatDay(points[0].date)}</span>
        <div className="flex items-center gap-2">
          <ChartArrowButton direction="left" disabled={pinnedIndex === 0} holdProps={backHold} />
          <ChartArrowButton direction="right" disabled={pinnedIndex === points.length - 1} holdProps={forwardHold} />
        </div>
        <span>{formatDay(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
