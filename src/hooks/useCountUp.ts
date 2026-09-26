import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 700;

/**
 * Animates from the previous value to `value` with an ease-out curve.
 * Returns the in-flight value each frame; callers format (round) for display.
 * Skips the animation entirely for users who prefer reduced motion.
 */
export function useCountUp(value: number): number {
  // Session-stable browser preference, captured once.
  const [reduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [animated, setAnimated] = useState(0);
  // Last value the rAF loop reached — lets a new result continue from the
  // current number instead of restarting from zero. Only touched in effects.
  const currentRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const from = currentRef.current ?? 0;
    if (from === value) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = from + (value - from) * eased;
      currentRef.current = next;
      setAnimated(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, reduced]);

  return reduced ? value : animated;
}
