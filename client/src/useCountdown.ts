import { useEffect, useState } from 'react';

/**
 * Milliseconds left until a deadline the server expressed as "remaining time".
 * Measured with the local monotonic clock so client/server clock skew does not matter.
 * Remount (via `key`) when a new deadline starts.
 */
export function useCountdown(remainingMs: number): number {
  const [deadline, setDeadline] = useState(() => performance.now() + remainingMs);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    // Read the clock once so "now" and the deadline share a base (otherwise 30.000s can display as 31s).
    const start = performance.now();
    setDeadline(start + remainingMs);
    setNow(start);
  }, [remainingMs]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  return Math.max(0, deadline - now);
}
