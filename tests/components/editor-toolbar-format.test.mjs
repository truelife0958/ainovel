import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFormatToText } from "../../lib/editor/format.js";

test("wrap bold around selection", () => {
  const r = applyFormatToText("hello world", 6, 11, { type: "wrap", before: "**", after: "**" });
  assert.equal(r.value, "hello **world**");
  assert.equal(r.cursorPos, 15);
});

test("wrap with no selection inserts placeholder '文本'", () => {
  const r = applyFormatToText("abc", 1, 1, { type: "wrap", before: "*", after: "*" });
  assert.equal(r.value, "a*文本*bc");
  assert.equal(r.cursorPos, 2);
});

test("prefix heading adds '# ' at line start", () => {
  const r = applyFormatToText("line\nother", 0, 0, { type: "prefix", prefix: "# " });
  assert.equal(r.value, "# line\nother");
  assert.equal(r.cursorPos, 2);
});

test("prefix toggle removes existing prefix", () => {
  const r = applyFormatToText("# already\nother", 0, 9, { type: "prefix", prefix: "# " });
  assert.equal(r.value, "already\nother");
});

test("insert literal text", () => {
  const r = applyFormatToText("abc", 2, 2, { type: "insert", text: "--" });
  assert.equal(r.value, "ab--c");
  assert.equal(r.cursorPos, 4);
});

test("prefix on non-first line finds correct line start", () => {
  const r = applyFormatToText("first\nsecond", 6, 12, { type: "prefix", prefix: "> " });
  assert.equal(r.value, "first\n> second");
});
