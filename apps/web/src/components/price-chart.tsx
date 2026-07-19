"use client";

import { useId, useMemo, useState, type MouseEvent } from "react";
import type { PricePoint } from "@/lib/types";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 26;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const GRID_LEVELS = [0, 25, 50, 75, 100];

export function PriceChart({ pricePoints }: { pricePoints: PricePoint[] }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo(
    () =>
      pricePoints.map((p) => ({
        t: new Date(p.timestamp).getTime(),
        yes: Number(p.yesPrice) * 100,
      })),
    [pricePoints],
  );

  if (points.length < 2) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-line bg-surface text-center">
        <p className="text-sm text-muted">Pas encore d&apos;historique de prix.</p>
        <p className="mt-1 text-xs text-muted">Soyez le premier à parier sur ce marché.</p>
      </div>
    );
  }

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const spanT = Math.max(maxT - minT, 1);

  const x = (t: number) => PAD_LEFT + ((t - minT) / spanT) * INNER_WIDTH;
  const y = (v: number) => PAD_TOP + (1 - v / 100) * INNER_HEIGHT;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(2)} ${y(p.yes).toFixed(2)}`).join(" ");
  const areaPath = `${path} L ${x(points[points.length - 1].t).toFixed(2)} ${HEIGHT - PAD_BOTTOM} L ${x(points[0].t).toFixed(2)} ${HEIGHT - PAD_BOTTOM} Z`;
  const last = points[points.length - 1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const t = minT + ((relX - PAD_LEFT) / INNER_WIDTH) * spanT;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.t - t);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-muted">Évolution du prix (OUI)</p>
        <p className="font-mono text-sm tabular-nums text-yes">{last.yes.toFixed(0)}%</p>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--yes)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--yes)" stopOpacity="0" />
          </linearGradient>
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

        <path d={areaPath} fill={`url(#${gradientId})`} />

        <path
          d={path}
          fill="none"
          className="stroke-yes"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px var(--yes))" }}
        />

        <circle
          cx={x(last.t)}
          cy={y(last.yes)}
          r={3}
          className="fill-yes"
          style={{ filter: "drop-shadow(0 0 6px var(--yes))" }}
        />

        {hovered && (
          <>
            <line
              x1={x(hovered.t)}
              x2={x(hovered.t)}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              className="stroke-muted"
              strokeWidth={1}
            />
            <circle cx={x(hovered.t)} cy={y(hovered.yes)} r={4} className="fill-paper stroke-yes" strokeWidth={2} />
          </>
        )}
      </svg>
      <div className="mt-1 flex h-4 justify-between font-mono text-xs text-muted">
        {hovered ? (
          <>
            <span>
              {new Date(hovered.t).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-yes">{hovered.yes.toFixed(0)}%</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
