import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectHeaderFocus,
  buildProjectWorkspaceRowFocus,
} from "../../lib/projects/focus.js";

test("buildProjectHeaderFocus returns empty-state copy when no project is selected", () => {
  const focus = buildProjectHeaderFocus(null);

  assert.equal(focus.title, "未检测到项目");
  assert.equal(focus.subtitle, "请先创建或打开项目");
});

test("buildProjectHeaderFocus normalizes missing genre while keeping chapter progress", () => {
  const focus = buildProjectHeaderFocus({
    id: "demo",
    root: "/tmp/demo",
    title: "雾站账本",
    genre: "",
    currentChapter: 6,
    currentVolume: 1,
    totalWords: 120000,
    targetWords: 1000000,
    targetChapters: 300,
    settingFilesCount: 3,
    outlineFilesCount: 2,
    chaptersCount: 6,
  });

  assert.equal(focus.title, "雾站账本");
  assert.equal(focus.subtitle, "未设置题材 · 第 6 章");
});

test("buildProjectWorkspaceRowFocus returns compact project progress for workspace list", () => {
  const focus = buildProjectWorkspaceRowFocus({
    id: "demo",
    root: "/tmp/demo",
    title: "雾站账本",
    genre: "都市异能",
    currentChapter: 12,
    currentVolume: 2,
    totalWords: 180000,
    targetWords: 1000000,
    targetChapters: 300,
    settingFilesCount: 4,
    outlineFilesCount: 3,
    chaptersCount: 12,
  });

  assert.equal(focus.progressLabel, "都市异能 · 第 2 卷 / 第 12 章");
  assert.equal(focus.directoryLabel, "目录：demo");
});
