import { test, expect } from "@playwright/test";
import { mockAiStandardReply } from "./helpers/mock-ai.mjs";

test.describe("Batch generation", () => {
  test("3-chapter mocked run completes", async ({ page }) => {
    await mockAiStandardReply(page);
    await page.route("**/api/projects/current/documents", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              document: {
                kind: "chapter", fileName: "第0001章.md", title: "Mocked",
                content: "", directory: "", relativePath: "第0001章.md",
                updatedAt: new Date().toISOString(), preview: "",
              },
              documents: [],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    const batchBtn = page.getByRole("button", { name: /^批量生成/ });
    if (!(await batchBtn.isVisible().catch(() => false))) {
      test.skip(true, "Batch button hidden without AI-ready project");
    }
    await batchBtn.click();
    await page.getByLabel("起始章节").fill("1");
    await page.getByLabel("结束章节").fill("3");
    await page.getByRole("button", { name: "开始生成" }).click();
    await expect(page.getByText(/全部完成！共 3 章/)).toBeVisible({ timeout: 15000 });
  });
});
