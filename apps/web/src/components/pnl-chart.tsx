"use client";

import { useId, useMemo, useState, type MouseEvent } from "react";
import type { PnlPoint } from "@/lib/bet-stats";
import { ChartArrowButton } from "@/components/chart-arrow-button";
import { useHoldRepeat } from "@/lib/use-hold-repeat";

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 44;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

function formatDay(t: number) {
  return new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function eur(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

export function PnlChart({ points }: { points: PnlPoint[] }) {
  const gradientId = useId();
  const [pinnedIndex, setPinnedIndex] = useState(points.length - 1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const data = useMemo(
    () => points.map((p) => ({ t: new Date(p.date).getTime(), pnl: p.cumulativePnl })),
    [points],
  );

  const stepBack = () => setPinnedIndex((i) => Math.max(i - 1, 0));
  const stepForward = () => setPinnedIndex((i) => Math.min(i + 1, data.length - 1));
  const backHold = useHoldRepeat(stepBack);
  const forwardHold = useHoldRepeat(stepForward);

  if (data.length < 2) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-line bg-surface text-center">
        <p className="text-sm text-muted">Pas encore d&apos;historique de gains/pertes.</p>
        <p className="mt-1 text-xs text-muted">Cette courbe se remplira après vos premiers paris résolus.</p>
      </div>
    );
  }

  const minT = data[0].t;
  const maxT = data[data.length - 1].t;
  const spanT = Math.max(maxT - minT, 1);

  const rawMin = Math.min(...data.map((p) => p.pnl), 0);
  const rawMax = Math.max(...data.map((p) => p.pnl), 0);
  const domainPad = Math.max((rawMax - rawMin) * 0.1, 1);
  const domainMin = rawMin - domainPad;
  const domainMax = rawMax + domainPad;
  const domainSpan = Math.max(domainMax - domainMin, 1);

  const x = (t: number) => PAD_LEFT + ((t - minT) / spanT) * INNER_WIDTH;
  const y = (v: number) => PAD_TOP + (1 - (v - domainMin) / domainSpan) * INNER_HEIGHT;

  const path = data.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(2)} ${y(p.pnl).toFixed(2)}`).join(" ");
  const areaPath = `${path} L ${x(data[data.length - 1].t).toFixed(2)} ${y(0).toFixed(2)} L ${x(data[0].t).toFixed(2)} ${y(0).toFixed(2)} Z`;
  const last = data[data.length - 1];
  const lineGlow = last.pnl >= 0 ? "var(--yes)" : "var(--no)";
  const lineTone = last.pnl >= 0 ? "stroke-yes" : "stroke-no";

  const displayIndex = hoverIndex ?? pinnedIndex;
  const current = data[displayIndex];
  const isLatest = displayIndex === data.length - 1;
  const currentTone = current.pnl >= 0 ? "text-yes" : "text-no";
  const currentDotTone = current.pnl >= 0 ? "fill-yes" : "fill-no";

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const t = minT + ((relX - PAD_LEFT) / INNER_WIDTH) * spanT;
    let nearest = 0;
    let best = Infinity;
    data.forEach((p, i) => {
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
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">Gains / pertes cumulés</p>
          <p className={`mt-1 font-mono text-3xl tabular-nums ${currentTone} sm:text-4xl`}>{eur(current.pnl)}</p>
        </div>
        <p className="font-mono text-xs text-muted">{isLatest ? "aujourd'hui" : formatDay(current.t)}</p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 w-full cursor-crosshair touch-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineGlow} stopOpacity="0.32" />
              <stop offset="100%" stopColor={lineGlow} stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={y(0)}
            y2={y(0)}
            className="stroke-line"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text x={0} y={y(0) + 3} className="fill-muted font-mono" fontSize={9}>
            0 €
          </text>

          <path d={areaPath} fill={`url(#${gradientId})`} />

          <path
            d={path}
            fill="none"
            className={lineTone}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${lineGlow})` }}
          />

          <line
            x1={x(current.t)}
            x2={x(current.t)}
            y1={PAD_TOP}
            y2={HEIGHT - PAD_BOTTOM}
            className="stroke-muted"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle
            cx={x(current.t)}
            cy={y(current.pnl)}
            r={4}
            className={currentDotTone}
            style={{ filter: `drop-shadow(0 0 6px ${lineGlow})` }}
          />
      </svg>

      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted">
        <span>{formatDay(data[0].t)}</span>
        <div className="flex items-center gap-2">
          <ChartArrowButton direction="left" disabled={pinnedIndex === 0} holdProps={backHold} />
          <ChartArrowButton direction="right" disabled={pinnedIndex === data.length - 1} holdProps={forwardHold} />
        </div>
        <span>{formatDay(data[data.length - 1].t)}</span>
      </div>
    </div>
  );
}
