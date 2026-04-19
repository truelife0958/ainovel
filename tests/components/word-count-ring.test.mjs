import { test } from "node:test";
import assert from "node:assert/strict";
import { ringGeometry } from "../../lib/ui/word-count-ring.js";

test("ratio is 0 for zero progress", () => {
  const g = ringGeometry(0, 1000, 10);
  assert.equal(g.ratio, 0);
  assert.equal(g.dashOffset, g.dashArray);
  assert.equal(g.over, false);
});

test("ratio caps at 1 even when current exceeds target", () => {
  const g = ringGeometry(2000, 1000, 10);
  assert.equal(g.ratio, 1);
  assert.equal(g.dashOffset, 0);
  assert.equal(g.over, true);
});

test("target 0 does not divide by zero", () => {
  const g = ringGeometry(500, 0, 10);
  assert.ok(Number.isFinite(g.dashOffset));
  assert.equal(g.over, true);
});

test("50% progress yields half-offset", () => {
  const g = ringGeometry(500, 1000, 10);
  assert.ok(Math.abs(g.ratio - 0.5) < 1e-6);
  assert.ok(Math.abs(g.dashOffset - g.dashArray / 2) < 1e-6);
});

test("negative current is treated as 0", () => {
  const g = ringGeometry(-50, 1000, 10);
  assert.equal(g.ratio, 0);
});
