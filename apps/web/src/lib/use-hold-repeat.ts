"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Press-and-hold repeat: fires `callback` once immediately, then again every
 * `intervalMs` while the pointer stays down, until release/leave.
 */
export function useHoldRepeat(callback: () => void, intervalMs = 130) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    callback();
    intervalRef.current = setInterval(callback, intervalMs);
  }, [callback, intervalMs, stop]);

  useEffect(() => stop, [stop]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}
