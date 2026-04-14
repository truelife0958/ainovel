import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardMetrics } from "../../lib/dashboard/metrics.js";

test("buildDashboardMetrics returns onboarding-oriented placeholders when no project exists", () => {
  const metrics = buildDashboardMetrics(null);

  assert.deepEqual(metrics, [
    {
      label: "当前卷",
      value: "待创建",
      hint: "创建项目后自动同步卷进度",
    },
    {
      label: "当前章",
      value: "待创建",
      hint: "立项完成后再进入章节链路",
    },
    {
      label: "设定文件",
      value: "0 份",
      hint: "创建项目后开始沉淀设定资料",
    },
    {
      label: "大纲文件",
      value: "0 份",
      hint: "总纲、卷纲和节拍表会显示在这里",
    },
  ]);
});

test("buildDashboardMetrics returns current project progress when a project is selected", () => {
  const metrics = buildDashboardMetrics({
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

  assert.deepEqual(metrics, [
    {
      label: "当前卷",
      value: "第 2 卷",
      hint: "项目进度",
    },
    {
      label: "当前章",
      value: "第 12 章",
      hint: "后续接写作任务书",
    },
    {
      label: "设定文件",
      value: "4",
      hint: "设定资料可持续扩展",
    },
    {
      label: "大纲文件",
      value: "3",
      hint: "总纲、卷纲、节拍表入口",
    },
  ]);
});
