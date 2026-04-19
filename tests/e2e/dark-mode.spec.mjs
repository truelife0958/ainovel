import { test, expect } from "@playwright/test";
import { assertNoAxeCriticalViolations } from "./helpers/a11y.mjs";

test.describe("Dark mode", () => {
  test("toggle persists across reload", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /切换.*模式/ });
    if (!(await toggle.isVisible().catch(() => false))) {
      test.skip(true, "theme toggle hidden (no toolbar in welcome-only state)");
    }
    await toggle.click();
    const theme1 = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(["dark", "light"]).toContain(theme1);
    await page.reload();
    const theme2 = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme2).toBe(theme1);
    await assertNoAxeCriticalViolations(page, "dark-mode:toggle");
  });

  test("system preference honored when no manual preference stored", async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem("theme"); } catch {}
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("dark");
    await assertNoAxeCriticalViolations(page, "dark-mode:system");
  });
});
