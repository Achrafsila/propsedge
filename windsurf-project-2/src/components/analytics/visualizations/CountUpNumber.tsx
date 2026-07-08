"use client";

import { useEffect, useRef, useState } from "react";

// Same requestAnimationFrame + cubic-ease-out count-up pattern as
// src/app/dashboard/page.tsx's AnimatedNumber, extracted here since that
// function isn't exported across route boundaries. Purely a display
// animation — the value itself always comes from the caller.
export function CountUpNumber({
  value,
  format,
  duration = 1200,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    let t0: number | null = null;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(value * e);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return <>{format(display)}</>;
}
