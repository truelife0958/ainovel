import { expect } from "@playwright/test";

export const liveAiConfig = {
  providerId: process.env.WEBNOVEL_WRITER_E2E_PROVIDER || "openai",
  apiKey: process.env.WEBNOVEL_WRITER_E2E_API_KEY || "",
  baseUrl: process.env.WEBNOVEL_WRITER_E2E_BASE_URL || "",
  model: process.env.WEBNOVEL_WRITER_E2E_MODEL || "",
  minimumChapterChars: Number(process.env.WEBNOVEL_WRITER_E2E_MIN_CHAPTER_CHARS || "400"),
  runLiveAi: process.env.WEBNOVEL_WRITER_E2E_LIVE_AI === "1",
};

const providerLabelMap = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  qwen: "通义千问",
  glm: "智谱GLM",
  gemini: "Gemini",
  mistral: "Mistral",
  custom: "通用API",
};

export const providerLabel = providerLabelMap[liveAiConfig.providerId] || "OpenAI";

export async function createProject(page, suffix) {
  const runId = Date.now();
  const projectTitle = `${suffix} ${runId}`;
  const folderName = `${suffix.toLowerCase().replace(/\s+/g, "-")}-${runId}`;

  await page.goto("/projects");
  await page.getByLabel("作品标题").fill(projectTitle);
  await page.getByLabel("目录名").fill(folderName);
  await page.getByLabel("题材方向").fill("都市异能");
  await page.getByLabel("目标读者").fill("通用网文读者");
  await page.getByRole("button", { name: "创建并设为当前项目" }).click();
  await expect(page.locator(".project-pill")).toContainText(projectTitle);

  return { projectTitle, folderName };
}

export async function configureProvider(page) {
  await page.goto("/connection");

  const providerCard = page.locator(".provider-card").filter({ hasText: providerLabel });
  await providerCard.getByLabel("API Key").fill(liveAiConfig.apiKey);
  if (liveAiConfig.baseUrl) {
    await providerCard.getByLabel("Base URL").fill(liveAiConfig.baseUrl);
  }
  if (liveAiConfig.model) {
    await providerCard.getByLabel("默认模型").fill(liveAiConfig.model);
  }
  await page.getByRole("button", { name: "保存" }).click();
  await expect(providerCard.getByText("已配置")).toBeVisible();
}

export async function createChapter(page, chapterTitle = "第0002章") {
  await page.goto("/workspace");
  await page.getByPlaceholder("例如：第6章 或 第0006章").fill(chapterTitle);
  await page.getByRole("button", { name: "新建章节" }).click();
  await expect(page.getByText(`已创建《${chapterTitle}》`)).toBeVisible();
}

export async function createOutline(page, outlineTitle = "第一卷卷纲") {
  await page.goto("/workspace?type=outline");
  await page.getByPlaceholder("例如：第一卷卷纲 / 主线节拍 / 终局回收表").fill(outlineTitle);
  await page.getByRole("button", { name: "新建大纲" }).click();
  await expect(page.getByText(`已创建《${outlineTitle}》`)).toBeVisible();
}
