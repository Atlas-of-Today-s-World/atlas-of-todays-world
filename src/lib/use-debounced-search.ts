"use client";

import { useEffect, useState } from "react";

type Outcome<T> = { query: string; attempt: number } & (
  { failed: false; results: T[] } | { failed: true }
);

/**
 * Search as you type against one of our JSON endpoints (`?q=` → `{ results }`):
 * waits `delay` ms after the last keystroke, aborts the request a newer query
 * replaced, and tells "searching", "found these" and "failed" (rate limit,
 * offline, server error) apart. Results always belong to the current query —
 * a new one clears the old ones instead of showing them under it.
 */
export function useDebouncedSearch<T>(
  endpoint: string,
  query: string,
  { delay, enabled }: { delay: number; enabled: boolean },
) {
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search answered ${response.status}`);
        const data = (await response.json()) as { results?: T[] };
        setOutcome({ query, attempt, failed: false, results: data.results ?? [] });
      } catch {
        // Aborted because the query changed: the newer request answers instead.
        if (!controller.signal.aborted) setOutcome({ query, attempt, failed: true });
      }
    }, delay);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [endpoint, query, delay, enabled, attempt]);

  const current = outcome?.query === query && outcome.attempt === attempt ? outcome : null;
  return {
    loading: enabled && !current,
    failed: enabled && Boolean(current?.failed),
    results: current && !current.failed ? current.results : [],
    /** Runs the same query again (after a failure). */
    retry: () => setAttempt((count) => count + 1),
  };
}
