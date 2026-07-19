"use client";

type HoldProps = {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
};

export function ChartArrowButton({
  direction,
  disabled,
  holdProps,
}: {
  direction: "left" | "right";
  disabled?: boolean;
  holdProps: HoldProps;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={direction === "left" ? "Reculer dans le temps" : "Avancer dans le temps"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-brand hover:text-paper disabled:opacity-30 disabled:hover:border-line disabled:hover:text-muted"
      {...holdProps}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  );
}
