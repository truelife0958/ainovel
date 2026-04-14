import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  createDependencyCacheRoot,
  ensureRuntimeDependencies,
  shouldCopyDirectly,
  seedDependencyCache,
  createRuntimeRoot,
  syncRuntimeCopy,
} from "./playwright-e2e-runtime.mjs";

const sourceRoot = process.cwd();
const runtimeRoot = createRuntimeRoot(sourceRoot);
const devPort = process.env.WEBNOVEL_WRITER_E2E_PORT || String(3201 + (process.pid % 2000));
const passthroughArgs = process.argv.slice(2);

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
    child.on("error", rejectPromise);
  });
}

function resolveConfigRoot(root, env = process.env) {
  return resolve(env.WEBNOVEL_WRITER_CONFIG_ROOT || join(root, ".playwright", "config"));
}

async function main() {
  if (process.env.WEBNOVEL_WRITER_E2E_DIRECT === "1" || !shouldCopyDirectly(sourceRoot)) {
    const configRoot = resolveConfigRoot(sourceRoot);
    await rm(configRoot, { recursive: true, force: true });
    try {
      await run("node", ["./node_modules/@playwright/test/cli.js", "test", ...passthroughArgs], {
        cwd: sourceRoot,
        env: {
          ...process.env,
          WEBNOVEL_WRITER_E2E_DIRECT: "1",
          WEBNOVEL_WRITER_E2E_PORT: devPort,
          WEBNOVEL_WRITER_CONFIG_ROOT: configRoot,
        },
      });
    } finally {
      await rm(configRoot, { recursive: true, force: true });
    }
    return;
  }

  const cacheRoot = await createDependencyCacheRoot(sourceRoot);
  console.log(`Syncing repo to ${runtimeRoot} for stable Playwright execution...`);
  await syncRuntimeCopy(sourceRoot, runtimeRoot);
  try {
    let dependencyStrategy = await ensureRuntimeDependencies({ runtimeRoot, cacheRoot });
    if (dependencyStrategy === "install-cache") {
      console.log(`Building dependency cache at ${cacheRoot}...`);
      await seedDependencyCache({ sourceRoot, cacheRoot });
      await run("npm", ["ci"], { cwd: cacheRoot, env: process.env });
      dependencyStrategy = await ensureRuntimeDependencies({ runtimeRoot, cacheRoot });
    } else {
      console.log(`Reusing dependency cache at ${cacheRoot}.`);
    }

    if (dependencyStrategy !== "reuse-cache") {
      throw new Error("Failed to hydrate runtime dependencies from cache.");
    }

    await run("node", ["./scripts/run-playwright-e2e.mjs", ...passthroughArgs], {
      cwd: runtimeRoot,
      env: {
        ...process.env,
        WEBNOVEL_WRITER_E2E_DIRECT: "1",
        WEBNOVEL_WRITER_E2E_PORT: devPort,
      },
    });
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});