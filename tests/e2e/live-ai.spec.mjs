import { expect, test } from "@playwright/test";
import {
  assertChapterBriefQuality,
  assertChapterDraftQuality,
  assertOutlineQuality,
} from "./live-ai-quality.mjs";
import {
  configureProvider,
  createChapter,
  createOutline,
  createProject,
  liveAiConfig,
  providerLabel,
} from "./live-ai-helpers.mjs";

test.describe.configure({ mode: "serial" });

test.skip(
  !liveAiConfig.runLiveAi || !liveAiConfig.apiKey,
  "Set WEBNOVEL_WRITER_E2E_LIVE_AI=1 and WEBNOVEL_WRITER_E2E_API_KEY to run live AI browser checks.",
);

test("@live-ai enables AI actions after provider setup and can generate a chapter plan plus chapter draft", async ({ page }) => {
  test.setTimeout(180000);
  await createProject(page, "Live AI");
  await configureProvider(page);

  await createChapter(page, "第0002章");

  await expect(page.getByRole("button", { name: "AI 规划本章" })).toBeEnabled();
  await expect(page.getByText(new RegExp(`AI 已就绪：${providerLabel}`))).toBeVisible();

  await page.locator('textarea[rows="4"]').fill("补齐目标、阻力、代价、爽点和章末钩子，风格偏男频快节奏。");
  await page.getByRole("button", { name: "AI 规划本章" }).click();

  await expect(page.getByText(/已使用 .* 执行 chapter_plan|已生成内容/)).toBeVisible({ timeout: 90000 });
  const briefArea = page.locator("textarea.compact-area");
  await expect(briefArea).toContainText("目标", { timeout: 30000 });
  await expect(briefArea).toContainText("钩子", { timeout: 30000 });
  const briefContent = await briefArea.inputValue();
  assertChapterBriefQuality(briefContent);

  const chapterArea = page.locator("textarea.editor-area").last();
  const initialChapterContent = await chapterArea.inputValue();

  await page.locator('textarea[rows="4"]').fill("基于刚生成的任务书直接写出本章正文，保留男频快节奏和章末悬念。");
  await page.getByRole("button", { name: "AI 生成正文" }).click();

  await expect(page.getByText(/已使用 .* 执行 chapter_write|已生成内容/)).toBeVisible({ timeout: 90000 });
  let generatedChapterContent = "";
  await expect(async () => {
    generatedChapterContent = await chapterArea.inputValue();
    expect(generatedChapterContent.length).toBeGreaterThan(initialChapterContent.length + 40);
  }).toPass({ timeout: 90000 });
  assertChapterDraftQuality(generatedChapterContent, { minimumChars: liveAiConfig.minimumChapterChars });

  await page.getByRole("button", { name: "保存正文" }).click();
  await expect(page.getByText("已保存《第0002章》")).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("textarea.compact-area")).toContainText("钩子", { timeout: 30000 });
  await expect(page.locator("textarea.editor-area").last()).toHaveValue(generatedChapterContent);
});

test("@live-ai review repair loop can deep-link into writing and clear the latest repair recommendation", async ({ page }) => {
  test.setTimeout(180000);
  await createProject(page, "Repair Loop");
  await configureProvider(page);

  await createChapter(page, "第0002章");

  const incompleteBrief = `### 第 2 章：雾站试探
- 目标: 探明雾站规则的核心漏洞
- 阻力: 站务员封锁出口并排查账本波动
- 代价: 林岚必须暴露一次账本能力
- 爽点: 规则反杀 - 借雾站规则反制追兵
- Strand: Quest
- 反派层级: 小Boss
- 视角/主角: 林岚
- 关键实体: 灰雾账本 / 雾站 / 站务员
- 本章变化: 林岚确认旧案与雾站规则直接关联
- 章末未闭合问题:
- 钩子:`;

  await page.locator("textarea.compact-area").fill(incompleteBrief);
  await page.getByRole("button", { name: "保存任务书" }).click();
  await expect(page.getByText("已保存第 2 章任务书")).toBeVisible();

  await page.goto("/review");
  await expect(page.getByText("主推荐动作：补钩子链")).toBeVisible();
  await expect(page.getByText(/优先处理：补钩子链|建议优先处理：补钩子链/)).toBeVisible();

  await page.getByRole("link", { name: "去创作台修补" }).click();
  await expect(page).toHaveURL(/\/workspace\?/);
  await expect(page.locator('textarea[rows="4"]')).toHaveValue(/章末未闭合问题、钩子/);
  await expect(page.getByRole("button", { name: "推荐：补钩子链" })).toBeEnabled();

  await page.getByRole("button", { name: "推荐：补钩子链" }).click();
  await expect(page.getByText(/已使用 .* 执行 chapter_plan|已生成内容/)).toBeVisible({ timeout: 90000 });

  const repairedBrief = await page.locator("textarea.compact-area").inputValue();
  assertChapterBriefQuality(repairedBrief);

  await page.goto("/review");
  await expect(page.getByText("主推荐动作：暂无")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("建议摘要：无")).toBeVisible();
});

test("@live-ai outline planning can generate a richer outline draft and persist it", async ({ page }) => {
  test.setTimeout(180000);
  await createProject(page, "Outline Live");
  await configureProvider(page);

  await createOutline(page, "第一卷卷纲");

  const outlineArea = page.locator("textarea.editor-area");
  await outlineArea.fill(`# 第一卷卷纲

## 核心冲突
主角在雾站规则中求生，并逐步发现旧案背后的镜像组织。
`);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("已保存《第一卷卷纲》")).toBeVisible();

  await expect(page.getByRole("button", { name: "AI 规划增强" })).toBeEnabled();
  await page.locator('textarea[rows="4"]').fill("补强卷级冲突链、节拍节点、章末钩子和兑现安排，保持平台无关。");
  await page.getByRole("button", { name: "AI 规划增强" }).click();

  await expect(page.getByText(/已使用 .* 更新《第一卷卷纲》/)).toBeVisible({ timeout: 90000 });
  let generatedOutline = "";
  await expect(async () => {
    generatedOutline = await outlineArea.inputValue();
    assertOutlineQuality(generatedOutline);
  }).toPass({ timeout: 90000 });

  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("已保存《第一卷卷纲》")).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("textarea.editor-area")).toHaveValue(generatedOutline);
});
