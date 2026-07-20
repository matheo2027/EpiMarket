export type OptionTone = { stroke: string; fill: string; bg: string; text: string; glow: string };

// Fixed hue order (never cycled/reassigned by rank) shared by OptionsBar and
// OptionsPriceChart so a given option keeps the same color in both places.
const OPTION_TONES: OptionTone[] = [
  { stroke: "stroke-brand", fill: "fill-brand", bg: "bg-brand", text: "text-brand", glow: "var(--brand)" },
  { stroke: "stroke-yes", fill: "fill-yes", bg: "bg-yes", text: "text-yes", glow: "var(--yes)" },
  {
    stroke: "stroke-series-3",
    fill: "fill-series-3",
    bg: "bg-series-3",
    text: "text-series-3",
    glow: "var(--series-3)",
  },
  {
    stroke: "stroke-series-4",
    fill: "fill-series-4",
    bg: "bg-series-4",
    text: "text-series-4",
    glow: "var(--series-4)",
  },
  {
    stroke: "stroke-series-5",
    fill: "fill-series-5",
    bg: "bg-series-5",
    text: "text-series-5",
    glow: "var(--series-5)",
  },
  {
    stroke: "stroke-series-6",
    fill: "fill-series-6",
    bg: "bg-series-6",
    text: "text-series-6",
    glow: "var(--series-6)",
  },
];

export function optionTone(index: number): OptionTone {
  return OPTION_TONES[index % OPTION_TONES.length];
}
