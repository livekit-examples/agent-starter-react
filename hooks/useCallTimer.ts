'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the number of milliseconds elapsed while `isActive` is true.
 * Resets to zero whenever the session is not active.
 */
export function useCallTimer(isActive: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setElapsed(0);
      return;
    }

    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  return elapsed;
}

/** Formats milliseconds as `mm:ss`. */
export function formatCallTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
