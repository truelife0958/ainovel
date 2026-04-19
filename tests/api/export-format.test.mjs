import { test } from "node:test";
import assert from "node:assert/strict";
import { combineChaptersAsTxt, safeFileName } from "../../lib/projects/export.js";

test("empty list returns empty string", () => {
  assert.equal(combineChaptersAsTxt([]), "");
  assert.equal(combineChaptersAsTxt(null), "");
  assert.equal(combineChaptersAsTxt(undefined), "");
});

test("single chapter with title", () => {
  const out = combineChaptersAsTxt([{ title: "第一章", content: "内容" }]);
  assert.equal(out, "第一章\n\n内容");
});

test("multiple chapters joined with triple newline", () => {
  const out = combineChaptersAsTxt([
    { title: "T1", content: "A" },
    { title: "T2", content: "B" },
  ]);
  assert.equal(out, "T1\n\nA\n\n\nT2\n\nB");
});

test("content is trimmed to avoid doubled newlines", () => {
  const out = combineChaptersAsTxt([{ title: "T", content: "A  \n\n" }]);
  assert.equal(out, "T\n\nA");
});

test("safeFileName strips path separators and control chars", () => {
  assert.equal(safeFileName("a/b\\c"), "a_b_c");
  assert.equal(safeFileName("a\x00b"), "a_b");
});

test("safeFileName truncates to 120 chars", () => {
  const long = "x".repeat(200);
  assert.equal(safeFileName(long).length, 120);
});

test("safeFileName defaults to 'export' for empty input", () => {
  assert.equal(safeFileName(""), "export");
  assert.equal(safeFileName(null), "export");
});
