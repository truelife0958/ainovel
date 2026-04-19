import { test, expect } from "@playwright/test";
import { mockAiStandardReply } from "./helpers/mock-ai.mjs";

test.describe("Reference analysis", () => {
  test("renders mocked analysis output", async ({ page }) => {
    await mockAiStandardReply(page);
    await page.goto("/");
    const refBtn = page.getByRole("button", { name: /^参考借鉴/ });
    if (!(await refBtn.isVisible().catch(() => false))) {
      test.skip(true, "Reference button hidden without AI-ready project");
    }
    await refBtn.click();
    // The reference modal has an input and a submit button; the exact
    // placeholder/button labels may vary across revisions, so fall back
    // to the first textbox + first enabled button inside the modal.
    const modal = page.locator('[role="dialog"]');
    await modal.getByRole("textbox").first().fill("凡人修仙传");
    const startBtn = modal.getByRole("button", { name: /分析|开始/ }).first();
    await startBtn.click();
    await expect(page.getByText(/Mocked text|Generated mock content/)).toBeVisible({ timeout: 15000 });
  });
});
