import { test, expect } from "@playwright/test";
import { mockAiStandardReply } from "./helpers/mock-ai.mjs";

test.describe("Scaffold generation", () => {
  test("generates checked items", async ({ page }) => {
    await mockAiStandardReply(page);
    await page.route("**/api/projects/current/documents", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              document: { kind: "setting", fileName: "世界观.md", title: "世界观", content: "" },
              documents: [],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    const scaffoldBtn = page.getByRole("button", { name: /^一键生成/ });
    if (!(await scaffoldBtn.isVisible().catch(() => false))) {
      test.skip(true, "Scaffold button hidden without AI-ready project");
    }
    await scaffoldBtn.click();
    await page.getByRole("button", { name: /开始生成/ }).click();
    await expect(page.getByText(/全部完成！/)).toBeVisible({ timeout: 15000 });
  });
});
