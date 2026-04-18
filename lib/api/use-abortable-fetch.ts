import { useEffect, useRef } from "react";

/**
 * React hook for auto-cancelling fetch calls.
 *
 * - `run(url, init)` — fire a single fetch that auto-cancels when a newer
 *   `run` or `beginGeneration` happens, or when the component unmounts.
 * - `beginGeneration()` — return a signal for multiple concurrent fetches
 *   (e.g. `Promise.all`) that should all be cancelled together when the
 *   next generation begins.
 * - `abort()` — cancel any in-flight request owned by this hook.
 *
 * Typical use: switching between items (chapters, tabs) where only the
 * latest selection's requests should resolve.
 */
export function useAbortableFetch() {
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { ctrlRef.current?.abort(); };
  }, []);

  function beginGeneration(): AbortSignal {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    return ctrl.signal;
  }

  function run(url: RequestInfo, init: RequestInit = {}) {
    const signal = beginGeneration();
    return fetch(url, { ...init, signal });
  }

  function abort() {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
  }

  return { run, beginGeneration, abort };
}

/**
 * True if `err` is an AbortError from a cancelled fetch.
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

