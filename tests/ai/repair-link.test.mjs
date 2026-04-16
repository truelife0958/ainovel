import test from "node:test";
import assert from "node:assert/strict";

import { buildWritingRepairHref } from "../../lib/ai/repair-link.js";

test("buildWritingRepairHref encodes chapter file and repair request", () => {
  const href = buildWritingRepairHref(3, "仅补强结尾相关字段：章末未闭合问题、钩子。");

  assert.match(href, /^\/\?/);
  assert.match(href, /file=%E7%AC%AC0003%E7%AB%A0\.md/);
  assert.match(href, /assistantRequest=/);
});

test("buildWritingRepairHref returns root when chapter or request is missing", () => {
  assert.equal(buildWritingRepairHref(0, ""), "/");
});
