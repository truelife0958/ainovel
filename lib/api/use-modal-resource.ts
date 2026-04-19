"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ModalResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
};

/**
 * Fetch a JSON resource when `open` flips true; cancel and reset when
 * `open` flips false. Expects the project's `{ ok: boolean, data: T }`
 * API envelope. `retry()` re-fetches without needing a parent state
 * change.
 */
export function useModalResource<T>(url: string, open: boolean): ModalResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(false);
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (ctrl.signal.aborted) return;
        if (payload && payload.ok) setData(payload.data as T);
        else setError(true);
      })
      .catch((e) => {
        if ((e as Error)?.name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [url]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setData(null);
      setError(false);
      setLoading(false);
      return;
    }
    load();
    return () => abortRef.current?.abort();
  }, [open, load]);

  return { data, loading, error, retry: load };
}
