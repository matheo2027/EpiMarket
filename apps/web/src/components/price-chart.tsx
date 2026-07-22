"use client";

import { useId, useMemo, useState, type MouseEvent } from "react";
import type { PricePoint } from "@/lib/types";
import { ChartArrowButton } from "@/components/chart-arrow-button";
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

export function PriceChart({ pricePoints }: { pricePoints: PricePoint[] }) {
  const { language, t } = useLanguage();
  const formatDay = (time: number) =>
    new Date(time).toLocaleDateString(localeFor(language), { day: "2-digit", month: "short" });
  const yesGradientId = useId();
  const noGradientId = useId();
  const [pinnedIndex, setPinnedIndex] = useState(pricePoints.length - 1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo(
    () =>
      pricePoints.map((p) => {
        const yes = Number(p.yesPrice) * 100;
        return { t: new Date(p.timestamp).getTime(), yes, no: 100 - yes };
      }),
    [pricePoints],
  );

  const stepBack = () => setPinnedIndex((i) => Math.max(i - 1, 0));
  const stepForward = () => setPinnedIndex((i) => Math.min(i + 1, points.length - 1));
  const backHold = useHoldRepeat(stepBack);
  const forwardHold = useHoldRepeat(stepForward);

  if (points.length < 2) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-line bg-surface text-center">
        <p className="text-sm text-muted">{t("marketDetail.noPriceHistory")}</p>
        <p className="mt-1 text-xs text-muted">{t("marketDetail.beFirstToBet")}</p>
      </div>
    );
  }

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const spanT = Math.max(maxT - minT, 1);

  const x = (t: number) => PAD_LEFT + ((t - minT) / spanT) * INNER_WIDTH;
  const y = (v: number) => PAD_TOP + (1 - v / 100) * INNER_HEIGHT;

  const yesPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(2)} ${y(p.yes).toFixed(2)}`).join(" ");
  const noPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(2)} ${y(p.no).toFixed(2)}`).join(" ");
  const yesAreaPath = `${yesPath} L ${x(points[points.length - 1].t).toFixed(2)} ${HEIGHT - PAD_BOTTOM} L ${x(points[0].t).toFixed(2)} ${HEIGHT - PAD_BOTTOM} Z`;

  const displayIndex = hoverIndex ?? pinnedIndex;
  const current = points[displayIndex];
  const isLatest = displayIndex === points.length - 1;

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
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">{t("marketDetail.priceEvolution")}</p>
          <div className="mt-1 flex items-baseline gap-4">
            <p className="font-mono text-3xl tabular-nums text-yes sm:text-4xl">{current.yes.toFixed(0)}%</p>
            <p className="font-mono text-3xl tabular-nums text-no sm:text-4xl">{current.no.toFixed(0)}%</p>
          </div>
          <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-yes" /> {t("betForm.yes")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-no" /> {t("betForm.no")}
            </span>
          </div>
        </div>
        <p className="font-mono text-xs text-muted">{isLatest ? t("marketDetail.today") : formatDay(current.t)}</p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 w-full cursor-crosshair touch-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={yesGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--yes)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--yes)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={noGradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--no)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--no)" stopOpacity="0" />
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

        <path d={yesAreaPath} fill={`url(#${yesGradientId})`} />

        <path
          d={noPath}
          fill="none"
          className="stroke-no"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px var(--no))" }}
        />
        <path
          d={yesPath}
          fill="none"
          className="stroke-yes"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px var(--yes))" }}
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
          cy={y(current.yes)}
          r={4}
          className="fill-yes"
          style={{ filter: "drop-shadow(0 0 6px var(--yes))" }}
        />
        <circle
          cx={x(current.t)}
          cy={y(current.no)}
          r={4}
          className="fill-no"
          style={{ filter: "drop-shadow(0 0 6px var(--no))" }}
        />
      </svg>

      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted">
        <span>{formatDay(points[0].t)}</span>
        <div className="flex items-center gap-2">
          <ChartArrowButton direction="left" disabled={pinnedIndex === 0} holdProps={backHold} />
          <ChartArrowButton direction="right" disabled={pinnedIndex === points.length - 1} holdProps={forwardHold} />
        </div>
        <span>{formatDay(points[points.length - 1].t)}</span>
      </div>
    </div>
  );
}
