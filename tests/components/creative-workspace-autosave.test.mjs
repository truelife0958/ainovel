import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNextBackoffMs } from "../../components/creative-workspace-autosave.js";

test("backoff schedule is 30s → 60s → 120s → 300s with 300s cap", () => {
  assert.equal(computeNextBackoffMs(0), 30000);
  assert.equal(computeNextBackoffMs(1), 60000);
  assert.equal(computeNextBackoffMs(2), 120000);
  assert.equal(computeNextBackoffMs(3), 300000);
  assert.equal(computeNextBackoffMs(4), 300000);
  assert.equal(computeNextBackoffMs(10), 300000);
});

test("backoff handles negative input as 0", () => {
  assert.equal(computeNextBackoffMs(-1), 30000);
});
