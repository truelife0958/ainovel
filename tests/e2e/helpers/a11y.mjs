import AxeBuilder from "@axe-core/playwright";

/**
 * Run axe-core against the current page state and fail the test if any
 * CRITICAL violations are found. Serious / moderate / minor are
 * reported via console.warn but don't fail the suite.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} [tag] short label for log output
 */
export async function assertNoAxeCriticalViolations(page, tag = "page") {
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");
  const others = results.violations.filter((v) => v.impact !== "critical");
  if (others.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[a11y:${tag}] ${others.length} non-critical finding(s):`,
      others.map((v) => `${v.id}(${v.impact}) ×${v.nodes.length}`).join(", "),
    );
  }
  if (critical.length) {
    const summary = critical
      .map((v) => `- ${v.id}: ${v.help} — ${v.nodes.length} node(s)`)
      .join("\n");
    throw new Error(
      `[a11y:${tag}] ${critical.length} critical violation(s):\n${summary}`,
    );
  }
}
