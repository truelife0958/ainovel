import test from "node:test";
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createDependencyCacheRoot,
  createRuntimeRoot,
  ensureRuntimeDependencies,
  includeRuntimePath,
  seedDependencyCache,
  shouldCopyDirectly,
} from "../../scripts/playwright-e2e-runtime.mjs";

const createdDirs = [];

async function makeTempDir(name) {
  const root = await mkdir(join(tmpdir(), `webnovel-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`), {
    recursive: true,
  });
  createdDirs.push(root);
  return root;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("shouldCopyDirectly only enables runtime copy for /mnt workspaces", () => {
  assert.equal(shouldCopyDirectly("/mnt/d/project"), true);
  assert.equal(shouldCopyDirectly("/home/wu/project"), false);
});

test("createRuntimeRoot respects explicit env override", () => {
  const runtimeRoot = createRuntimeRoot("/mnt/d/project", {
    WEBNOVEL_WRITER_E2E_RUNTIME_ROOT: "/tmp/custom-runtime",
  });

  assert.equal(runtimeRoot, resolve("/tmp/custom-runtime"));
});

test("includeRuntimePath skips heavyweight top-level artifacts", () => {
  assert.equal(includeRuntimePath("/repo", "/repo/package.json"), true);
  assert.equal(includeRuntimePath("/repo", "/repo/node_modules/react"), false);
  assert.equal(includeRuntimePath("/repo", "/repo/.next/server"), false);
  assert.equal(includeRuntimePath("/repo", "/repo/tests/e2e/app-smoke.spec.mjs"), true);
});

test("createDependencyCacheRoot is deterministic for the same dependency manifests", async () => {
  const sourceRoot = await makeTempDir("cache-root");
  await writeFile(join(sourceRoot, "package.json"), '{"name":"webnovel"}', "utf8");
  await writeFile(join(sourceRoot, "package-lock.json"), '{"lockfileVersion":3}', "utf8");

  const first = await createDependencyCacheRoot(sourceRoot);
  const second = await createDependencyCacheRoot(sourceRoot);

  assert.equal(first, second);
});

test("seedDependencyCache copies dependency manifests into the cache root", async () => {
  const sourceRoot = await makeTempDir("source-manifests");
  const cacheRoot = await makeTempDir("cache-manifests");

  await writeFile(join(sourceRoot, "package.json"), '{"name":"webnovel"}', "utf8");
  await writeFile(join(sourceRoot, "package-lock.json"), '{"lockfileVersion":3}', "utf8");

  await seedDependencyCache({ sourceRoot, cacheRoot });

  await access(join(cacheRoot, "package.json"));
  await access(join(cacheRoot, "package-lock.json"));
});

test("ensureRuntimeDependencies copies cached node_modules into the runtime root", async () => {
  const cacheRoot = await makeTempDir("cache");
  const runtimeRoot = await makeTempDir("runtime");
  const cacheNodeModules = join(cacheRoot, "node_modules");
  const cacheFile = join(cacheNodeModules, "pkg", "index.js");
  const runtimeNodeModules = join(runtimeRoot, "node_modules");
  const runtimeFile = join(runtimeNodeModules, "pkg", "index.js");

  await mkdir(join(cacheNodeModules, "pkg"), { recursive: true });
  await writeFile(cacheFile, "export default 'ok';\n", "utf8");

  const strategy = await ensureRuntimeDependencies({ runtimeRoot, cacheRoot });
  const runtimeNodeModulesStat = await lstat(runtimeNodeModules);

  assert.equal(strategy, "reuse-cache");
  assert.equal(runtimeNodeModulesStat.isSymbolicLink(), false);
  assert.equal(await readFile(runtimeFile, "utf8"), "export default 'ok';\n");
});

test("ensureRuntimeDependencies falls back to install-cache strategy when cache is missing", async () => {
  const cacheRoot = await makeTempDir("cache-empty");
  const runtimeRoot = await makeTempDir("runtime-empty");

  const strategy = await ensureRuntimeDependencies({ runtimeRoot, cacheRoot });

  assert.equal(strategy, "install-cache");
  await assert.rejects(access(join(runtimeRoot, "node_modules")));
});
