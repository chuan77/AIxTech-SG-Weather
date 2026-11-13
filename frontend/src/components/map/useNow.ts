import { useEffect, useState } from 'react';

/** Current time in ms, re-read on an interval so age-based UI keeps updating without a request. */
export function useNow(intervalMs: number, refreshOn?: unknown): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-reads the clock when `refreshOn` changes
    setNow(Date.now());
  }, [refreshOn]);

  return now;
}
