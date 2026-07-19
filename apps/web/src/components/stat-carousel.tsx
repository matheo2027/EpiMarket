"use client";

import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { StatsHistoryPoint } from "@/lib/types";
import { StatChart, type StatChartPoint, type Tone } from "@/components/stat-chart";

type Slide = {
  key: string;
  label: string;
  tone: Tone;
  points: StatChartPoint[];
  format?: (n: number) => string;
};

function eurFormat(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export function StatCarousel({ history }: { history: StatsHistoryPoint[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startScrollLeft: number; dragged: boolean } | null>(null);
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);

  const slides: Slide[] = useMemo(
    () => [
      {
        key: "openMarkets",
        label: "Marchés ouverts",
        tone: "brand",
        points: history.map((h) => ({ date: h.date, value: h.openMarkets })),
      },
      {
        key: "totalVolume",
        label: "Volume total",
        tone: "yes",
        points: history.map((h) => ({ date: h.date, value: Number(h.totalVolume) })),
        format: eurFormat,
      },
      {
        key: "activeBets",
        label: "Paris actifs",
        tone: "series-3",
        points: history.map((h) => ({ date: h.date, value: h.activeBets })),
      },
      {
        key: "bettors",
        label: "Parieurs",
        tone: "series-4",
        points: history.map((h) => ({ date: h.date, value: h.bettors })),
      },
    ],
    [history],
  );

  function scrollToIndex(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.min(Math.max(index, 0), slides.length - 1);
    track.scrollTo({ left: clamped * (track.clientWidth + 16), behavior: "smooth" });
    setActive(clamped);
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0 || dragState.current) return;
    setActive(Math.round(track.scrollLeft / (track.clientWidth + 16)));
  }

  function handleDragStart(e: ReactMouseEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    dragState.current = { startX: e.clientX, startScrollLeft: track.scrollLeft, dragged: false };
    setDragging(true);
  }

  function handleDragMove(e: ReactMouseEvent<HTMLDivElement>) {
    const track = trackRef.current;
    const state = dragState.current;
    if (!track || !state) return;
    const delta = e.clientX - state.startX;
    if (Math.abs(delta) > 4) state.dragged = true;
    track.scrollLeft = state.startScrollLeft - delta;
  }

  function handleDragEnd() {
    const track = trackRef.current;
    const state = dragState.current;
    dragState.current = null;
    setDragging(false);
    if (!track || !state) return;
    const index = Math.round(track.scrollLeft / (track.clientWidth + 16));
    scrollToIndex(index);
  }

  if (history.length < 2) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex justify-center gap-1.5">
        {slides.map((slide, i) => (
          <button
            key={slide.key}
            type="button"
            onClick={() => scrollToIndex(i)}
            aria-label={`Voir ${slide.label}`}
            className={`h-1.5 rounded-full transition-all ${
              active === i ? "w-6 bg-brand shadow-[0_0_10px_var(--glow)]" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scrollToIndex(active - 1)}
          disabled={active === 0}
          aria-label="Statistique précédente"
          className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-xl text-paper shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:border-brand hover:shadow-[0_0_24px_var(--glow)] disabled:pointer-events-none disabled:opacity-0"
        >
          ‹
        </button>

        <div
          ref={trackRef}
          onScroll={handleScroll}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          className={`no-scrollbar flex gap-4 overflow-x-auto ${
            dragging ? "cursor-grabbing select-none" : "cursor-grab snap-x snap-mandatory scroll-smooth"
          }`}
        >
          {slides.map((slide) => (
            <div key={slide.key} className="w-full shrink-0 snap-center">
              <StatChart label={slide.label} points={slide.points} tone={slide.tone} format={slide.format} />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollToIndex(active + 1)}
          disabled={active === slides.length - 1}
          aria-label="Statistique suivante"
          className="absolute right-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-xl text-paper shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:border-brand hover:shadow-[0_0_24px_var(--glow)] disabled:pointer-events-none disabled:opacity-0"
        >
          ›
        </button>
      </div>
    </div>
  );
}
