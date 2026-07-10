"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Simple 1-second-tick countdown. Never auto-advances anything — reaching 0
 * only flips `done`; the caller decides what happens next (hybrid timing).
 */
export function useCountdown(
  seconds: number,
  opts: { autoStart?: boolean } = {}
) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(opts.autoStart ?? false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clear();
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return clear;
  }, [running, clear]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => {
    clear();
    setRunning(false);
  }, [clear]);
  const reset = useCallback(
    (next: number) => {
      clear();
      setRemaining(next);
      setRunning(true);
    },
    [clear]
  );

  return { remaining, running, done: remaining === 0, start, pause, reset };
}
