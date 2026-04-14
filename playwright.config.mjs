import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const isolatedConfigRoot = resolve(rootDir, ".playwright", "config");
const devPort = Number(process.env.WEBNOVEL_WRITER_E2E_PORT || "3201");
const baseURL = `http://127.0.0.1:${devPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `node ./node_modules/next/dist/bin/next dev --port ${devPort}`,
    url: baseURL,
    cwd: rootDir,
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-playwright",
      WEBNOVEL_WRITER_CONFIG_ROOT: isolatedConfigRoot,
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
