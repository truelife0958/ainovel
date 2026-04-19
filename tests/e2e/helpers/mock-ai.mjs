/**
 * Playwright route handler that mocks `/api/projects/current/actions`.
 * `responder` receives the parsed request body and returns the `data`
 * payload (this helper wraps it with `{ ok: true, data }`).
 *
 * Usage:
 *   import { mockAiStandardReply } from "./helpers/mock-ai.mjs";
 *   await mockAiStandardReply(page);
 *
 * @param {import("@playwright/test").Page} page
 * @param {(body: any) => unknown} responder
 * @param {{ latencyMs?: number }} [opts]
 */
export async function mockAi(page, responder, opts = {}) {
  await page.route("**/api/projects/current/actions", async (route) => {
    const req = route.request();
    const bodyStr = req.postData() || "{}";
    let body = {};
    try { body = JSON.parse(bodyStr); } catch { body = {}; }
    if (opts.latencyMs) {
      await new Promise((r) => setTimeout(r, opts.latencyMs));
    }
    const data = responder(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data }),
    });
  });
}

/**
 * Convenience: always return a plausible fake chapter/brief document.
 *
 * @param {import("@playwright/test").Page} page
 */
export async function mockAiStandardReply(page) {
  await mockAi(page, (body) => {
    const { mode, fileName } = body || {};
    const doc = {
      kind: "chapter",
      fileName: fileName || "第0001章.md",
      title: "Mocked Chapter",
      content: "Generated mock content",
      directory: "",
      relativePath: fileName || "第0001章.md",
      updatedAt: new Date().toISOString(),
      preview: "Generated mock content",
    };
    return {
      target: mode === "chapter_plan" ? "brief" : "document",
      provider: "openai",
      model: "gpt-4",
      role: "writing",
      generatedText: "Mocked text",
      document: doc,
      documents: [doc],
      briefValidation: null,
      downgraded: false,
      applyModeUsed: "replace",
      lastCall: { latencyMs: 420, usage: { input_tokens: 100, output_tokens: 50 } },
    };
  });
}
