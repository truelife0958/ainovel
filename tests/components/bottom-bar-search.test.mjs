import { test } from "node:test";
import assert from "node:assert/strict";
import { filterChapters } from "../../lib/ui/chapter-search.js";

const data = [
  { title: "序章", fileName: "第0000章.md", chapterNumber: 0 },
  { title: "觉醒", fileName: "第0001章.md", chapterNumber: 1 },
  { title: "试炼", fileName: "第0002章.md", chapterNumber: 2 },
  { title: "试探", fileName: "第0012章.md", chapterNumber: 12 },
];

test("empty query returns all", () => {
  assert.equal(filterChapters(data, "").length, 4);
  assert.equal(filterChapters(data, "   ").length, 4);
});

test("title substring match, case insensitive", () => {
  const out = filterChapters(data, "试");
  assert.equal(out.length, 2);
});

test("filename substring match (non-numeric)", () => {
  const out = filterChapters(data, "章");
  // all filenames contain "章"
  assert.equal(out.length, 4);
});

test("numeric exact match only (1 does not match 12)", () => {
  const out = filterChapters(data, "1");
  assert.equal(out.length, 1);
  assert.equal(out[0].chapterNumber, 1);
});

test("numeric 12 matches chapter 12", () => {
  const out = filterChapters(data, "12");
  assert.equal(out.length, 1);
  assert.equal(out[0].chapterNumber, 12);
});

test("query '001' is not pure numeric (leading zeros) — falls back to substring match", () => {
  const out = filterChapters(data, "001");
  // "001" contained in both 第0001章.md and 第0012章.md
  assert.equal(out.length, 2);
});
