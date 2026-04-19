import { test, expect } from "@playwright/test";
import { assertNoAxeCriticalViolations } from "./helpers/a11y.mjs";

test.describe("Export menu", () => {
  test("opens and lists two items when a project exists", async ({ page }) => {
    await page.goto("/");
    const exportBtn = page.getByRole("button", { name: /^导出/ });
    const hasProject = await exportBtn.isVisible().catch(() => false);
    test.skip(!hasProject, "Export menu hidden without a project");

    await exportBtn.click();
    await expect(page.getByRole("menuitem", { name: /当前章节/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /全部章节合并/ })).toBeVisible();
    await assertNoAxeCriticalViolations(page, "export:menu-open");
  });
});
