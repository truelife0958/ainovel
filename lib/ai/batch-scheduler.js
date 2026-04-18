/**
 * Rate-limit-aware batch scheduler. Runs tasks one at a time so that
 * a shared rate limit isn't exceeded; on a 429 response the scheduler
 * reads Retry-After, calls `onWait(seconds)` for UI feedback, and
 * retries the same task. After `maxConsecutiveErrors` non-429 failures
 * in a row it calls `onPause(reason)` and stops.
 *
 * Errors are surfaced as either:
 *   - HTTP 429: `{ status: 429, retryAfterSeconds?: number }` — scheduler
 *     waits and retries (does NOT consume the consecutiveErrors budget)
 *   - Anything else: `onProgress(i, { ok: false, error })` + increments
 *     the consecutiveErrors counter; scheduler moves to the next task
 *     unless the threshold is reached.
 *
 * @typedef {{ ok: boolean, error?: Error, value?: unknown }} BatchTaskResult
 * @typedef {() => Promise<unknown>} BatchTask
 * @typedef {{
 *   onProgress: (index: number, result: BatchTaskResult) => void,
 *   onWait: (seconds: number) => void,
 *   onPause?: (reason: string) => void,
 *   signal?: AbortSignal,
 *   sleep?: (ms: number) => Promise<void>,
 *   maxConsecutiveErrors?: number,
 * }} BatchOpts
 *
 * @param {BatchTask[]} tasks
 * @param {BatchOpts} opts
 * @returns {Promise<void>}
 */
export async function runBatch(tasks, opts) {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxConsecutive = opts.maxConsecutiveErrors ?? 3;
  let consecutiveErrors = 0;

  for (let i = 0; i < tasks.length; i++) {
    if (opts.signal?.aborted) return;

    // Retry the same task on 429.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (opts.signal?.aborted) return;
      try {
        const value = await tasks[i]();
        opts.onProgress(i, { ok: true, value });
        consecutiveErrors = 0;
        break;
      } catch (err) {
        if (err && err.status === 429) {
          const sec = Math.max(1, err.retryAfterSeconds ?? 30);
          opts.onWait(sec);
          await sleep(sec * 1000);
          continue;
        }
        opts.onProgress(i, { ok: false, error: err });
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutive) {
          if (opts.onPause) opts.onPause(`连续 ${maxConsecutive} 次失败，已暂停`);
          return;
        }
        break;
      }
    }
  }
}
