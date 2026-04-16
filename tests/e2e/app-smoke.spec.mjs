import { expect, test } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const workspaceRoot = process.cwd();
const currentProjectMarker = join(workspaceRoot, ".claude", ".webnovel-current-project");
const runId = `${Date.now()}`;
const folderName = `e2e-modal-${runId}`;
const projectTitle = `E2E Modal ${runId}`;
const projectRoot = join(workspaceRoot, folderName);

async function readOptionalFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function restoreCurrentProject(markerContent) {
  if (markerContent === null) {
    await rm(currentProjectMarker, { force: true });
    return;
  }

  await mkdir(join(workspaceRoot, ".claude"), { recursive: true });
  await writeFile(currentProjectMarker, markerContent, "utf8");
}

test.describe.configure({ mode: "serial" });

test.describe("single-page workspace smoke flow", () => {
  let previousCurrentProject = null;

  test.beforeAll(async () => {
    previousCurrentProject = await readOptionalFile(currentProjectMarker);
    await rm(projectRoot, { recursive: true, force: true });
  });

  test.afterAll(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await restoreCurrentProject(previousCurrentProject);
  });

  test("legacy routes redirect to home", async ({ page }) => {
    for (const path of ["/dashboard", "/settings", "/library", "/outline", "/writing", "/projects", "/review", "/connection", "/ideation", "/workspace"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test("covers toolbar, modals, editor bottom actions, and API-backed persistence", async ({ page }) => {
    await page.goto("/");

    // Open project manager and create/switch project
    await page.getByRole("button", { name: /管理项目…|创建作品/ }).click()
      .catch(async () => {
        await page.getByRole("button", { name: /▾/ }).first().click();
      });
    const manageEntry = page.getByRole("button", { name: /\+ 管理项目…/ }).first();
    if (await manageEntry.count()) {
      await manageEntry.click();
    }
    await expect(page.getByRole("dialog", { name: "项目管理" })).toBeVisible();

    const titleField = page.getByLabel("作品标题");
    if (await titleField.count()) {
      await titleField.fill(projectTitle);
      await page.getByLabel("目录名").fill(folderName);
      await page.getByLabel("题材方向").fill("都市异能");
      await page.getByLabel("目标读者").fill("男频爽文读者");
      await page.getByRole("button", { name: "创建并设为当前项目" }).click();
      await expect(page.getByText(`已创建并切换到《${projectTitle}》`)).toBeVisible();
    } else {
      await page.locator(".project-row").filter({ hasText: /我的规则不一样|E2E Smoke/ }).first()
        .getByRole("button", { name: "切换" }).click();
      await expect(page.getByText(/当前项目已切换为《/)).toBeVisible();
    }

    // Close project modal
    await page.locator('.modal-dialog.wide .modal-close').click();

    // Open ideation modal from toolbar
    await page.getByRole("button", { name: "立项" }).click();
    await expect(page.getByRole("dialog", { name: "立项" })).toBeVisible();

    await page.getByLabel("主角名").fill("林岚");
    await page.getByLabel("主角结构").fill("落魄调查员");
    await page.getByLabel("金手指名称").fill("灰雾账本");
    await page.getByLabel("金手指类型").fill("规则账本");
    await page.getByLabel("金手指风格").fill("冷硬反噬");
    await page.getByLabel("核心卖点").fill("规则反杀、都市异闻、持续追更钩子");
    await page.getByRole("button", { name: "保存立项信息" }).click();
    await expect(page.getByText("立项信息已保存")).toBeVisible();

    await page.locator('.modal-dialog.wide .modal-close').click();

    // Open connection modal and configure custom API
    await page.getByRole("button", { name: /AI 未连接|AI 就绪/ }).click();
    await expect(page.getByRole("dialog", { name: "AI 连接" })).toBeVisible();

    await page.getByLabel("Base URL").fill("https://api.openai.com/v1");
    await page.getByLabel("API Key").fill("sk-smoke-custom-api");
    await page.getByRole("button", { name: "保存并启用" }).click();
    await expect(page.getByText("连接配置已保存")).toBeVisible();

    await page.locator('.modal-dialog.standard .modal-close').click();

    // Create chapter via bottom bar dropdown input
    await page.getByRole("button", { name: "章节" }).click();

    await page.getByRole("button", { name: /选择章节|第0001章/ }).click();
    await page.getByPlaceholder("新建章节").fill("第0002章");
    await page.getByRole("button", { name: "新建" }).click();
    await expect(page.getByText("已创建《第0002章》")).toBeVisible();

    // Open brief panel and save a valid brief
    await page.locator(".bottom-bar").getByRole("button", { name: "任务书", exact: true }).click();
    const briefArea = page.locator("textarea.compact-area").first();
    await briefArea.fill(`### 第 2 章：雾站试探\n- 目标: 确认灰雾账本代价\n- 主要冲突: 雾站追查与账本暴露\n- 承接上章: 主角在雾站入口遭遇封锁\n- 阻力: 站务员封锁出口\n- 代价: 暴露账本能力\n- 爽点: 规则反杀 - 逆用站规\n- Strand: quest\n- 反派层级: 小Boss\n- 视角/主角: 林岚\n- 关键实体: 灰雾账本 / 雾站 / 站务员\n- 本章变化: 主角确认旧案与雾站关联\n- 章末未闭合问题: 雾站背后是谁在操控\n- 钩子: 悬念钩 - 账本自动翻页到未知页`);
    await page.getByRole("button", { name: "保存任务书" }).click();
    await expect(page.getByText("已保存第 2 章任务书")).toBeVisible();
    await page.keyboard.press("Escape");

    // Save chapter content
    const editor = page.locator(".creation-editor-area textarea").first();
    await editor.fill("# 第0002章 雾站试探\\n\\n林岚第一次主动利用账本规则反制追查者。\\n");
    await page.locator(".bottom-bar").getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("已保存《第0002章》")).toBeVisible();

    // AI buttons: chapter
    await expect(page.getByRole("button", { name: "AI 规划" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI 生成" })).toBeVisible();

    // Switch to outline and verify outline AI action
    await page.getByRole("button", { name: "大纲" }).click();
    await page.getByRole("button", { name: /选择大纲|总纲/ }).click();
    await page.getByPlaceholder("新建大纲").fill("第一卷卷纲");
    await page.getByRole("button", { name: "新建" }).click();
    await expect(page.getByText("已创建《第一卷卷纲》")).toBeVisible();
    await expect(page.getByRole("button", { name: "AI 规划增强" })).toBeVisible();

    // Setting view should hide AI actions
    await page.getByRole("button", { name: "设定" }).click();
    await page.getByRole("button", { name: /选择设定|作品定位/ }).click();
    await page.getByPlaceholder("新建设定").fill("主角卡");
    await page.getByRole("button", { name: "新建" }).click();
    await expect(page.getByText("已创建《主角卡》")).toBeVisible();
    await expect(page.getByRole("button", { name: "AI 规划" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI 生成" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI 规划增强" })).toHaveCount(0);

    // Review modal is reachable from toolbar
    await page.getByRole("button", { name: "审查" }).click();
    await expect(page.getByRole("dialog", { name: "审查" })).toBeVisible();
    await expect(page.getByText("问题中心与修复入口")).toBeVisible();
    await page.locator('.modal-dialog.standard .modal-close').click();

    // Validate persisted files
    const state = JSON.parse(await readFile(resolve(projectRoot, ".webnovel", "state.json"), "utf8"));
    expect(state.project_info.title).toBe(projectTitle);
    expect(state.progress.current_chapter).toBeGreaterThanOrEqual(2);
    expect(await readFile(resolve(projectRoot, "正文", "第0002章.md"), "utf8")).toContain("雾站试探");
    expect(await readFile(resolve(projectRoot, "大纲", "第一卷卷纲.md"), "utf8")).toBeDefined();
    expect(await readFile(resolve(projectRoot, "设定集", "主角卡.md"), "utf8")).toBeDefined();
  });
});
