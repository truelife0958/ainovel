import { expect, test } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const workspaceRoot = process.cwd();
const currentProjectMarker = join(workspaceRoot, ".claude", ".webnovel-current-project");
const runId = `${Date.now()}`;
const folderName = `e2e-smoke-${runId}`;
const projectTitle = `E2E Smoke ${runId}`;
const projectRoot = join(workspaceRoot, folderName);
const secondFolderName = `e2e-switch-${runId}`;
const secondProjectTitle = `E2E Switch ${runId}`;
const secondProjectRoot = join(workspaceRoot, secondFolderName);

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

async function contentOverflow(page) {
  return page.evaluate(() => {
    const content = document.querySelector(".content");
    if (!(content instanceof HTMLElement)) {
      return 0;
    }
    return content.scrollWidth - content.clientWidth;
  });
}

test.describe.configure({ mode: "serial" });

test.describe("webnovel writer smoke flow", () => {
  let previousCurrentProject = null;

  test.beforeAll(async () => {
    previousCurrentProject = await readOptionalFile(currentProjectMarker);
    await rm(projectRoot, { recursive: true, force: true });
    await rm(secondProjectRoot, { recursive: true, force: true });
  });

  test.afterAll(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(secondProjectRoot, { recursive: true, force: true });
    await restoreCurrentProject(previousCurrentProject);
  });

  test("redirects the root route to projects", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { name: "项目", exact: true })).toBeVisible();
  });

  test("redirects old routes to new routes", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/projects$/);

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/connection$/);

    await page.goto("/library");
    await expect(page).toHaveURL(/\/workspace\?type=setting$/);

    await page.goto("/outline");
    await expect(page).toHaveURL(/\/workspace\?type=outline$/);

    await page.goto("/writing");
    await expect(page).toHaveURL(/\/workspace$/);
  });

  test("covers projects, ideation, workspace (setting/outline/chapter), review and connection", async ({ page }) => {
    // --- Projects page (formerly dashboard) ---
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "项目", exact: true })).toBeVisible();

    await page.getByLabel("作品标题").fill(projectTitle);
    await page.getByLabel("目录名").fill(folderName);
    await page.getByLabel("题材方向").fill("都市异能");
    await page.getByLabel("目标读者").fill("男频爽文读者");
    await page.getByRole("button", { name: "创建并设为当前项目" }).click();

    await expect(page.getByText(`已创建并切换到《${projectTitle}》`)).toBeVisible();
    await expect(page.locator(".project-pill")).toContainText(projectTitle);
    await expect(page.locator(".project-pill")).toContainText("第 1 章");

    // --- Ideation page ---
    await page.goto("/ideation");
    await expect(page.getByRole("heading", { name: "立项", exact: true })).toBeVisible();
    await page.getByLabel("主角名").fill("林岚");
    await page.getByLabel("主角结构").fill("落魄调查员");
    await page.getByLabel("金手指名称").fill("灰雾账本");
    await page.getByLabel("金手指类型").fill("规则账本");
    await page.getByLabel("金手指风格").fill("冷酷反噬");
    await page.getByLabel("核心卖点").fill("规则反杀、账本升级、都市异闻连续钩子");
    await page.getByRole("button", { name: "保存立项信息" }).click();

    await expect(page.getByText("立项信息已保存")).toBeVisible();
    await expect(page.getByText("7 / 7")).toBeVisible();

    // --- Workspace: Setting (formerly /library) ---
    await page.goto("/workspace?type=setting");
    await expect(page.getByRole("heading", { name: "创作", exact: true })).toBeVisible();
    await page.getByPlaceholder("例如：势力设定 / 道具规则 / 阵营关系").fill("主角卡");
    await page.getByRole("button", { name: "新建设定" }).click();

    await expect(page.getByText("已创建《主角卡》")).toBeVisible();
    await page.locator("textarea.editor-area").fill("# 主角卡\n\n- 姓名：林岚\n- 当前身份：落魄调查员\n- 主要欲望：活着查清旧案\n");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("已保存《主角卡》")).toBeVisible();

    // --- Workspace: Outline (formerly /outline) ---
    await page.goto("/workspace?type=outline");
    await expect(page.getByRole("heading", { name: "创作", exact: true })).toBeVisible();
    await page.getByPlaceholder("例如：第一卷卷纲 / 主线节拍 / 终局回收表").fill("第一卷卷纲");
    await page.getByRole("button", { name: "新建大纲" }).click();

    await expect(page.getByText("已创建《第一卷卷纲》")).toBeVisible();
    await page.locator("textarea.editor-area").fill(
      "# 第一卷卷纲\n\n## 核心冲突\n林岚用灰雾账本破解雾站规则，并发现旧案背后的镜像组织。\n",
    );
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("已保存《第一卷卷纲》")).toBeVisible();
    await expect(page.getByRole("button", { name: "AI 规划增强" })).toBeDisabled();
    await expect(page.getByText(/AI 未就绪：请先在连接页为 OpenAI 配置 API Key/)).toBeVisible();

    // --- Workspace: Chapter (formerly /writing) ---
    await page.goto("/workspace");
    await expect(page.getByRole("heading", { name: "创作", exact: true })).toBeVisible();
    await page.getByPlaceholder("例如：第6章 或 第0006章").fill("第0002章");
    await page.getByRole("button", { name: "新建章节" }).click();

    await expect(page.getByText("已创建《第0002章》")).toBeVisible();
    await page.locator("textarea.compact-area").fill(`### 第 2 章：雾站试探
- 目标: 确认灰雾账本的代价
- 阻力: 站务员封锁出口并追查异常波动
- 代价: 林岚必须主动暴露一次账本能力
- 爽点: 规则反杀 / 账本预知
- Strand: quest
- 反派层级: 小Boss
- 视角/主角: 林岚
- 关键实体: 灰雾账本 / 雾站 / 站务员
- 本章变化: 林岚确认雾站规则与旧案有关
- 章末未闭合问题:
- 钩子:`);
    await page.getByRole("button", { name: "保存任务书" }).click();

    await expect(page.getByText("已保存第 2 章任务书")).toBeVisible();
    await expect(page.getByRole("button", { name: "AI 规划本章" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "AI 生成正文" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "执行修补动作" })).toBeDisabled();
    await expect(page.getByText(/AI 未就绪：请先在连接页为 OpenAI 配置 API Key/)).toBeVisible();

    await page.locator("textarea.editor-area").nth(1).fill(
      "# 第0002章 雾站试探\n\n林岚在末班雾站翻开账本，第一次主动用规则反杀追查者。\n",
    );
    await page.getByRole("button", { name: "保存正文" }).click();
    await expect(page.getByText("已保存《第0002章》")).toBeVisible();

    // --- Review page (problem center) ---
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "审查", exact: true })).toBeVisible();
    await expect(page.getByText("章节：第 2 章")).toBeVisible();
    await expect(page.getByRole("link", { name: "去创作台修补" })).toBeVisible();

    await page.getByRole("link", { name: "去创作台修补" }).click();
    await expect(page).toHaveURL(/\/workspace\?/);
    await expect(page.getByRole("button", { name: "推荐：补钩子链" })).toBeVisible();
    await expect(page.getByRole("button", { name: "推荐：补钩子链" })).toBeDisabled();
    await expect(page.locator('textarea[rows="4"]')).toHaveValue(/章末未闭合问题、钩子/);

    // --- Connection page (AI onboarding, formerly /settings) ---
    await page.goto("/connection");
    await expect(page.getByRole("heading", { name: "连接", exact: true })).toBeVisible();

    const openaiCard = page.locator(".provider-card").filter({ hasText: "OpenAI" });
    await openaiCard.locator('input[type="password"]').fill("sk-smoke-openai");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(openaiCard.getByText("已配置")).toBeVisible();

    // Verify AI readiness in workspace
    await page.goto("/workspace?type=outline");
    await expect(page.getByRole("button", { name: "AI 规划增强" })).toBeEnabled();
    await expect(page.getByText(/AI 已就绪：OpenAI/)).toBeVisible();

    await page.goto("/workspace");
    await expect(page.getByRole("button", { name: "AI 规划本章" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "AI 生成正文" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "执行修补动作" })).toBeEnabled();
    await expect(page.getByText(/AI 已就绪：OpenAI/)).toBeVisible();

    // Clear API key
    await page.goto("/connection");
    await openaiCard.getByLabel("保存时清空已保存 API Key").check();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(openaiCard.getByText("未配置")).toBeVisible();

    await page.goto("/workspace");
    await expect(page.getByRole("button", { name: "AI 规划本章" })).toBeDisabled();
    await expect(page.getByText(/AI 未就绪：请先在连接页为 OpenAI 配置 API Key/)).toBeVisible();

    // Verify persisted data
    const state = JSON.parse(await readFile(resolve(projectRoot, ".webnovel", "state.json"), "utf8"));

    expect(state.project_info.title).toBe(projectTitle);
    expect(state.progress.current_chapter).toBe(2);
    expect(await readFile(resolve(projectRoot, ".webnovel", "index.db"), "utf8")).toBeDefined();
    expect(await readFile(resolve(projectRoot, "设定集", "主角卡.md"), "utf8")).toContain("林岚");
    expect(await readFile(resolve(projectRoot, "大纲", "第一卷卷纲.md"), "utf8")).toContain("灰雾账本");
    expect(await readFile(resolve(projectRoot, "正文", "第0002章.md"), "utf8")).toContain("雾站试探");

    // --- Second project ---
    await page.goto("/projects");
    await page.getByLabel("作品标题").fill(secondProjectTitle);
    await page.getByLabel("目录名").fill(secondFolderName);
    await page.getByLabel("题材方向").fill("赛博悬疑");
    await page.getByLabel("目标读者").fill("悬疑读者");
    await page.getByRole("button", { name: "创建并设为当前项目" }).click();

    await expect(page.getByText(`已创建并切换到《${secondProjectTitle}》`)).toBeVisible();
    await expect(page.locator(".project-pill")).toContainText(secondProjectTitle);

    await page.goto("/ideation");
    await page.getByLabel("主角名").fill("沈烬");
    await page.getByLabel("主角结构").fill("失控审计员");
    await page.getByLabel("金手指名称").fill("回声索引");
    await page.getByLabel("金手指类型").fill("记忆检索");
    await page.getByLabel("金手指风格").fill("冷硬悬疑");
    await page.getByLabel("核心卖点").fill("记忆篡改、赛博谜案、追凶反转");
    await page.getByRole("button", { name: "保存立项信息" }).click();
    await expect(page.getByText("立项信息已保存")).toBeVisible();

    await page.goto("/workspace?type=setting");
    await page.getByPlaceholder("例如：势力设定 / 道具规则 / 阵营关系").fill("组织档案");
    await page.getByRole("button", { name: "新建设定" }).click();
    await expect(page.getByText("已创建《组织档案》")).toBeVisible();
    await page.locator("textarea.editor-area").fill("# 组织档案\n\n- 名称：回声审计局\n");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("已保存《组织档案》")).toBeVisible();

    await page.goto("/workspace?type=outline");
    await page.getByPlaceholder("例如：第一卷卷纲 / 主线节拍 / 终局回收表").fill("第二项目卷纲");
    await page.getByRole("button", { name: "新建大纲" }).click();
    await expect(page.getByText("已创建《第二项目卷纲》")).toBeVisible();
    await page.locator("textarea.editor-area").fill("# 第二项目卷纲\n\n## 核心冲突\n沈烬追查记忆篡改链。\n");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("已保存《第二项目卷纲》")).toBeVisible();

    await page.goto("/workspace");
    await page.getByPlaceholder("例如：第6章 或 第0006章").fill("第0003章");
    await page.getByRole("button", { name: "新建章节" }).click();
    await expect(page.getByText("已创建《第0003章》")).toBeVisible();
    await page.locator("textarea.compact-area").fill(`### 第 3 章：回声追踪
- 目标: 锁定篡改源头
- 阻力: 线索持续被覆盖
- 代价: 沈烬暴露审计权限
- 爽点: 逆向追踪 / 即时反制
- Strand: mystery
- 反派层级: 小Boss
- 视角/主角: 沈烬
- 关键实体: 回声索引 / 审计局
- 本章变化: 找到第一处伪造记忆节点
- 章末未闭合问题:
- 钩子:`);
    await page.getByRole("button", { name: "保存任务书" }).click();
    await expect(page.getByText("已保存第 3 章任务书")).toBeVisible();
    await page.locator("textarea.editor-area").nth(1).fill("# 第0003章 回声追踪\n\n沈烬在档案海里追到第一处伪造记忆节点。\n");
    await page.getByRole("button", { name: "保存正文" }).click();
    await expect(page.getByText("已保存《第0003章》")).toBeVisible();

    // --- Switch back to first project ---
    await page.goto("/projects");
    const firstProjectRow = page.locator(".project-row").filter({ hasText: projectTitle });
    await firstProjectRow.getByRole("button", { name: "切换" }).click();
    await expect(page.getByText(`当前项目已切换为《${projectTitle}》`)).toBeVisible();
    await expect(page.locator(".project-pill")).toContainText(projectTitle);

    await page.goto("/workspace?type=setting");
    await expect(page.locator(".editor-toolbar strong")).toHaveText("主角卡");
    await expect(page.locator("textarea.editor-area")).toHaveValue(/林岚/);

    await page.goto("/workspace?type=outline");
    await expect(page.locator(".editor-toolbar strong")).toHaveText("第一卷卷纲");
    await expect(page.locator("textarea.editor-area")).toHaveValue(/灰雾账本/);

    await page.goto("/workspace");
    await expect(page.locator("textarea.compact-area")).toHaveValue(/林岚/);
    await expect(page.locator("textarea.editor-area").nth(1)).toHaveValue(/雾站试探/);

    // --- Switch back to second project ---
    await page.goto("/projects");
    const secondProjectRow = page.locator(".project-row").filter({ hasText: secondProjectTitle });
    await secondProjectRow.getByRole("button", { name: "切换" }).click();
    await expect(page.getByText(`当前项目已切换为《${secondProjectTitle}》`)).toBeVisible();
    await expect(page.locator(".project-pill")).toContainText(secondProjectTitle);

    await page.goto("/ideation");
    await expect(page.getByLabel("主角名")).toHaveValue("沈烬");
    await expect(page.getByText("赛博悬疑")).toBeVisible();

    await page.goto("/workspace?type=setting");
    await expect(page.locator(".editor-toolbar strong")).toHaveText("组织档案");
    await expect(page.locator("textarea.editor-area")).toHaveValue(/回声审计局/);

    await page.goto("/workspace?type=outline");
    await expect(page.locator(".editor-toolbar strong")).toHaveText("第二项目卷纲");
    await expect(page.locator("textarea.editor-area")).toHaveValue(/记忆篡改链/);

    await page.goto("/workspace");
    await expect(page.locator("textarea.compact-area")).toHaveValue(/沈烬/);
    await expect(page.locator("textarea.editor-area").nth(1)).toHaveValue(/回声追踪/);

    const secondState = JSON.parse(await readFile(resolve(secondProjectRoot, ".webnovel", "state.json"), "utf8"));
    expect(secondState.project_info.title).toBe(secondProjectTitle);
    expect(secondState.protagonist_state.name).toBe("沈烬");
    expect(await readFile(resolve(secondProjectRoot, "设定集", "组织档案.md"), "utf8")).toContain("回声审计局");
    expect(await readFile(resolve(secondProjectRoot, "大纲", "第二项目卷纲.md"), "utf8")).toContain("记忆篡改链");
    expect(await readFile(resolve(secondProjectRoot, "正文", "第0003章.md"), "utf8")).toContain("回声追踪");
  });

  test("keeps key pages usable on mobile widths", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });

    for (const path of ["/projects", "/ideation", "/workspace", "/review", "/connection"]) {
      await page.goto(path);
      expect(await contentOverflow(page)).toBeLessThanOrEqual(1);
      await expect(page.locator(".nav")).toBeVisible();
    }
  });
});
