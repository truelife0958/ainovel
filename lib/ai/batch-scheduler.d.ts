export type BatchTaskResult = { ok: boolean; error?: Error; value?: unknown };
export type BatchTask = () => Promise<unknown>;
export type BatchOpts = {
  onProgress: (index: number, result: BatchTaskResult) => void;
  onWait: (seconds: number) => void;
  onPause?: (reason: string) => void;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
  maxConsecutiveErrors?: number;
};
export function runBatch(tasks: BatchTask[], opts: BatchOpts): Promise<void>;
