import { test } from "node:test";
import assert from "node:assert/strict";
import { runBatch } from "../../lib/ai/batch-scheduler.js";

function make429(retryAfter = 1) {
  const err = new Error("rate limited");
  err.status = 429;
  err.retryAfterSeconds = retryAfter;
  return err;
}

test("runBatch completes all tasks when all succeed", async () => {
  const results = [];
  const progress = [];
  await runBatch([
    () => { results.push("a"); return Promise.resolve("A"); },
    () => { results.push("b"); return Promise.resolve("B"); },
    () => { results.push("c"); return Promise.resolve("C"); },
  ], {
    onProgress: (i, r) => progress.push({ i, ok: r.ok }),
    onWait: () => {},
    sleep: () => Promise.resolve(),
  });
  assert.deepEqual(results, ["a", "b", "c"]);
  assert.deepEqual(progress, [
    { i: 0, ok: true },
    { i: 1, ok: true },
    { i: 2, ok: true },
  ]);
});

test("runBatch waits on 429 and retries the same task until it succeeds", async () => {
  const waitCalls = [];
  let firstAttempts = 0;
  let secondAttempts = 0;
  await runBatch([
    async () => {
      firstAttempts++;
      if (firstAttempts === 1) throw make429(2);
      return "ok1";
    },
    async () => {
      secondAttempts++;
      return "ok2";
    },
  ], {
    onProgress: () => {},
    onWait: (sec) => waitCalls.push(sec),
    sleep: () => Promise.resolve(),
  });
  assert.equal(firstAttempts, 2);
  assert.equal(secondAttempts, 1);
  assert.deepEqual(waitCalls, [2]);
});

test("runBatch stops when signal is aborted mid-batch", async () => {
  const ctrl = new AbortController();
  const executed = [];
  await runBatch([
    async () => { executed.push(0); ctrl.abort(); return "a"; },
    async () => { executed.push(1); return "b"; },
    async () => { executed.push(2); return "c"; },
  ], {
    onProgress: () => {},
    onWait: () => {},
    sleep: () => Promise.resolve(),
    signal: ctrl.signal,
  });
  assert.deepEqual(executed, [0]);
});

test("runBatch pauses after maxConsecutiveErrors non-429 errors", async () => {
  const attempts = [];
  const paused = [];
  await runBatch([
    async () => { attempts.push(0); throw new Error("boom"); },
    async () => { attempts.push(1); throw new Error("boom"); },
    async () => { attempts.push(2); throw new Error("boom"); },
    async () => { attempts.push(3); throw new Error("should not run"); },
  ], {
    onProgress: () => {},
    onWait: () => {},
    sleep: () => Promise.resolve(),
    onPause: (reason) => paused.push(reason),
  });
  assert.deepEqual(attempts, [0, 1, 2]);
  assert.equal(paused.length, 1);
});

test("runBatch consecutive error counter resets after a success", async () => {
  const attempts = [];
  let calls = 0;
  await runBatch([
    async () => { calls++; attempts.push("fail-0"); throw new Error("boom"); },
    async () => { calls++; attempts.push("ok-1"); return "ok"; },
    async () => { calls++; attempts.push("fail-2"); throw new Error("boom"); },
    async () => { calls++; attempts.push("fail-3"); throw new Error("boom"); },
    async () => { calls++; attempts.push("ok-4"); return "ok"; },
  ], {
    onProgress: () => {},
    onWait: () => {},
    sleep: () => Promise.resolve(),
  });
  // None of these are 3-in-a-row so all 5 run.
  assert.equal(calls, 5);
});
