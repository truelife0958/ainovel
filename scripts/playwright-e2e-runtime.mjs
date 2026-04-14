import { constants } from "node:fs";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

const ignoreTopLevel = new Set([
  "node_modules",
  ".next",
  ".next-playwright",
  ".playwright",
  "playwright-report",
  "test-results",
  ".coverage",
]);

export function createRuntimeRoot(sourceRoot, env = process.env, options = {}) {
  return resolve(
    env.WEBNOVEL_WRITER_E2E_RUNTIME_ROOT ||
      join(
        options.tmpDir || tmpdir(),
        `${basename(sourceRoot)}-e2e-runtime-${options.pid || process.pid}-${options.now || Date.now()}`,
      ),
  );
}

export function shouldCopyDirectly(root) {
  return root.startsWith("/mnt/");
}

export function includeRuntimePath(sourceRoot, sourcePath) {
  const rel = relative(sourceRoot, sourcePath);
  if (!rel) {
    return true;
  }

  const topLevel = rel.split(sep)[0];
  return !ignoreTopLevel.has(topLevel);
}

export async function syncRuntimeCopy(sourceRoot, runtimeRoot) {
  await rm(runtimeRoot, { recursive: true, force: true });
  await cp(sourceRoot, runtimeRoot, {
    recursive: true,
    force: true,
    filter: (sourcePath) => includeRuntimePath(sourceRoot, sourcePath),
  });
}

export async function createDependencyCacheRoot(sourceRoot, env = process.env, options = {}) {
  if (env.WEBNOVEL_WRITER_E2E_CACHE_ROOT) {
    return resolve(env.WEBNOVEL_WRITER_E2E_CACHE_ROOT);
  }

  const hash = createHash("sha1");
  for (const fileName of ["package.json", "package-lock.json"]) {
    try {
      hash.update(await readFile(join(sourceRoot, fileName)));
    } catch {
      hash.update(fileName);
    }
  }

  return join(
    options.tmpDir || tmpdir(),
    `${basename(sourceRoot)}-e2e-cache-${hash.digest("hex").slice(0, 12)}`,
  );
}

async function hydrateRuntimeNodeModules(cacheNodeModules, runtimeNodeModules) {
  await rm(runtimeNodeModules, { recursive: true, force: true });
  await cp(cacheNodeModules, runtimeNodeModules, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
  });
}

export async function seedDependencyCache({ sourceRoot, cacheRoot }) {
  await rm(cacheRoot, { recursive: true, force: true });
  await mkdir(cacheRoot, { recursive: true });
  for (const fileName of ["package.json", "package-lock.json"]) {
    const sourceFile = join(sourceRoot, fileName);
    const cacheFile = join(cacheRoot, fileName);
    try {
      await writeFile(cacheFile, await readFile(sourceFile));
    } catch {
      // Ignore missing optional manifests.
    }
  }
}

export async function ensureRuntimeDependencies({ runtimeRoot, cacheRoot }) {
  const cacheNodeModules = join(cacheRoot, "node_modules");
  const runtimeNodeModules = join(runtimeRoot, "node_modules");

  try {
    await access(cacheNodeModules, constants.F_OK);
    await hydrateRuntimeNodeModules(cacheNodeModules, runtimeNodeModules);
    return "reuse-cache";
  } catch {
    return "install-cache";
  }
}