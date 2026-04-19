import { test } from "node:test";
import assert from "node:assert/strict";
import { applyResult } from "../../lib/ai/actions.js";

test("applyResult append under limit returns appended content + downgraded false", () => {
  const r = applyResult("hello", "world", "append");
  assert.equal(r.downgraded, false);
  assert.equal(r.content.endsWith("world\n"), true);
  assert.equal(r.content.startsWith("hello"), true);
});

test("applyResult append over 30KB flips to replace and signals downgraded", () => {
  const big = "x".repeat(31000);
  const r = applyResult(big, "new chapter", "append");
  assert.equal(r.downgraded, true);
  assert.equal(r.content, "new chapter");
});

test("applyResult replace is never downgraded", () => {
  const r = applyResult("hello", "world", "replace");
  assert.equal(r.downgraded, false);
  assert.equal(r.content, "world");
});

test("applyResult handles null inputs safely", () => {
  const r = applyResult(null, "x", "replace");
  assert.equal(r.downgraded, false);
  assert.equal(r.content, "x");
});
