import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractChapterNumber, asObject, asArray, typeLabel } from "../lib/utils.js";

describe("extractChapterNumber", () => {
  it("extracts from 第N章 pattern", () => {
    assert.equal(extractChapterNumber("第1章-起源.md"), 1);
    assert.equal(extractChapterNumber("第10卷第500章-终局.md"), 500);
  });

  it("falls back to first digit sequence", () => {
    assert.equal(extractChapterNumber("ch0042.md"), 42);
  });

  it("throws on no digits", () => {
    assert.throws(() => extractChapterNumber("readme.md"), /Unable to infer/);
  });

  it("handles empty/null input", () => {
    assert.throws(() => extractChapterNumber(""), /Unable to infer/);
    assert.throws(() => extractChapterNumber(null), /Unable to infer/);
  });
});

describe("asObject", () => {
  it("returns object as-is", () => {
    const obj = { a: 1 };
    assert.equal(asObject(obj), obj);
  });

  it("returns empty object for non-objects", () => {
    assert.deepEqual(asObject(null), {});
    assert.deepEqual(asObject(undefined), {});
    assert.deepEqual(asObject("str"), {});
    assert.deepEqual(asObject([1, 2]), {});
  });
});

describe("asArray", () => {
  it("returns array as-is", () => {
    const arr = [1, 2];
    assert.equal(asArray(arr), arr);
  });

  it("returns empty array for non-arrays", () => {
    assert.deepEqual(asArray(null), []);
    assert.deepEqual(asArray("str"), []);
    assert.deepEqual(asArray({}), []);
  });
});

describe("typeLabel", () => {
  it("maps types to Chinese labels", () => {
    assert.equal(typeLabel("setting"), "设定");
    assert.equal(typeLabel("outline"), "大纲");
    assert.equal(typeLabel("chapter"), "章节");
  });
});
