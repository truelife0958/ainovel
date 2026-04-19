"use client";

import { useEffect, useRef, useState } from "react";
import { computeNextBackoffMs } from "@/components/creative-workspace-autosave.js";

type SaveResult = { title?: string } | undefined;
type SaveFn = (opts?: { silent?: boolean }) => Promise<SaveResult>;

export type UseAutoSaveOptions = {
  save: SaveFn;
  enabled: boolean;
  initialDelayMs?: number;
};

export type UseAutoSaveReturn = {
  /** Non-null when the most recent attempt failed and is awaiting retry. */
  error: string | null;
  /** True for ~2 s after a successful silent save. */
  justSaved: boolean;
  /** Manually re-run save (non-silent); resets the failure counter on success. */
  retry: () => void;
};

const DEFAULT_DELAY = 30000;

/**
 * Auto-save loop with exponential backoff (30s → 60s → 120s → 300s).
 *
 * Consumer responsibilities:
 *   - `save({ silent })` that returns the saved document on success or
 *     `undefined` on failure (the hook interprets undefined as retry).
 *   - Toggle `enabled` based on dirty + idle state.
 *
 * The hook's internal failure counter decides the next delay; reaching
 * 5 min (failures ≥ 4) means slow retries until the next success.
 */
export function useAutoSave({ save, enabled, initialDelayMs = DEFAULT_DELAY }: UseAutoSaveOptions): UseAutoSaveReturn {
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedFlagTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);

  useEffect(() => { saveRef.current = save; }, [save]);

  useEffect(() => {
    if (!enabled) return;
    const delay = failures > 0 ? computeNextBackoffMs(failures - 1) : initialDelayMs;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void (async () => {
        const doc = await saveRef.current({ silent: true });
        if (doc) {
          setFailures(0);
          setError(null);
          setJustSaved(true);
          if (savedFlagTimerRef.current) clearTimeout(savedFlagTimerRef.current);
          savedFlagTimerRef.current = setTimeout(() => setJustSaved(false), 2000);
        } else {
          setFailures((n) => n + 1);
          setError("自动保存失败，将自动重试");
        }
      })();
    }, delay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [enabled, failures, initialDelayMs]);

  function retry() {
    setError(null);
    void (async () => {
      const doc = await saveRef.current({ silent: false });
      if (doc) setFailures(0);
    })();
  }

  return { error, justSaved, retry };
}
