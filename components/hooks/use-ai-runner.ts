"use client";

import { useEffect, useRef, useState } from "react";

export type AiRunnerMode = "chapter_plan" | "chapter_write" | "outline_plan";

export type AiRunInput = {
  mode: AiRunnerMode;
  kind: "chapter" | "setting" | "outline";
  fileName: string;
  applyMode: "append" | "replace";
};

export type AiRunResult = {
  target: "brief" | "document";
  document: {
    title?: string;
    fileName: string;
    content: string;
    [key: string]: unknown;
  };
  documents?: Array<{ fileName: string; title: string; [key: string]: unknown }>;
  downgraded?: boolean;
  lastCall?: { latencyMs: number; usage: unknown } | null;
  error?: string;
};

export type UseAiRunnerReturn = {
  aiRunning: boolean;
  downgradeNotice: string;
  lastCall: { latencyMs: number; usage: unknown } | null;
  runAi: (input: AiRunInput) => Promise<AiRunResult | null>;
  cancelAi: () => void;
};

/**
 * Owns the AbortController + aiRunning state for a single AI call.
 *
 * `runAi(input)` resolves to:
 *   - AiRunResult on success
 *   - `null` if the call was aborted (e.g. user clicked Cancel)
 *   - `{ error }` shape if the server returned a non-ok envelope
 *
 * The consumer decides how to surface errors / apply the returned
 * document to its own state. Downgrade notice and lastCall are owned
 * here for UI display and telemetry.
 */
export function useAiRunner(): UseAiRunnerReturn {
  const [aiRunning, setAiRunning] = useState(false);
  const [downgradeNotice, setDowngradeNotice] = useState("");
  const [lastCall, setLastCall] = useState<{ latencyMs: number; usage: unknown } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!downgradeNotice) return;
    const t = setTimeout(() => setDowngradeNotice(""), 5000);
    return () => clearTimeout(t);
  }, [downgradeNotice]);

  async function runAi(input: AiRunInput): Promise<AiRunResult | null> {
    setAiRunning(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    try {
      const res = await fetch("/api/projects/current/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: input.kind,
          fileName: input.fileName,
          mode: input.mode,
          userRequest: "",
          applyMode: input.applyMode,
        }),
        signal,
      });
      if (signal.aborted) return null;
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        return { error: payload.error || "AI 执行失败" } as AiRunResult;
      }
      const data = payload.data as AiRunResult;
      if (data.lastCall) setLastCall(data.lastCall);
      if (data.downgraded) setDowngradeNotice("原稿超 30KB，本次使用替换模式生成。");
      return data;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return null;
      return { error: "网络错误，AI 操作失败" } as AiRunResult;
    } finally {
      setAiRunning(false);
      abortRef.current = null;
    }
  }

  function cancelAi() {
    abortRef.current?.abort();
  }

  return { aiRunning, downgradeNotice, lastCall, runAi, cancelAi };
}
