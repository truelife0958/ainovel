import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Tier 6 Pass 2 sub-tier 6.3: smoke-cover lib/projects/state.js error branches
// (finding F7: branch% was 27.77, lowest in lib/projects/state.js).

function makeStateRoot(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(root, ".webnovel"), { recursive: true });
  return root;
}

test("readProjectIdeation rejects when state.json is missing (ENOENT branch)", async () => {
  const root = mkdtempSync(join(tmpdir(), "tier6-state-missing-"));
  try {
    const { readProjectIdeation } = await import("../../lib/projects/state.js");
    await assert.rejects(
      () => readProjectIdeation(root),
      (err) => /ENOENT|no such file/i.test(err.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProjectIdeation rejects malformed JSON with friendly message (corrupt branch)", async () => {
  const root = makeStateRoot("tier6-state-corrupt-");
  try {
    writeFileSync(join(root, ".webnovel", "state.json"), "{not valid json");
    const { readProjectIdeation } = await import("../../lib/projects/state.js");
    await assert.rejects(
      () => readProjectIdeation(root),
      (err) => /corrupted|restore from backup|re-initialize/.test(err.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProjectIdeation rejects non-object state (invalid-structure branch, array)", async () => {
  const root = makeStateRoot("tier6-state-array-");
  try {
    writeFileSync(join(root, ".webnovel", "state.json"), "[]");
    const { readProjectIdeation } = await import("../../lib/projects/state.js");
    await assert.rejects(
      () => readProjectIdeation(root),
      (err) => /invalid structure/.test(err.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProjectIdeation rejects non-object state (null branch)", async () => {
  const root = makeStateRoot("tier6-state-null-");
  try {
    writeFileSync(join(root, ".webnovel", "state.json"), "null");
    const { readProjectIdeation } = await import("../../lib/projects/state.js");
    await assert.rejects(
      () => readProjectIdeation(root),
      (err) => /invalid structure/.test(err.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProjectIdeation parses well-formed state and returns trimmed defaults", async () => {
  const root = makeStateRoot("tier6-state-happy-");
  try {
    writeFileSync(
      join(root, ".webnovel", "state.json"),
      JSON.stringify({
        project_info: { title: "  T6  ", target_words: "2000000", genre: "都市异能" },
        protagonist_state: { name: "林岚" },
      }),
    );
    const { readProjectIdeation } = await import("../../lib/projects/state.js");
    const out = await readProjectIdeation(root);
    assert.equal(out.title, "  T6  "); // readProjectIdeation does not trim on read; only update trims
    assert.equal(out.targetWords, 2000000); // toNumber accepts numeric strings
    assert.equal(out.genre, "都市异能");
    assert.equal(out.protagonistName, "林岚");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("updateProjectIdeation round-trips and trims values on write", async () => {
  const root = makeStateRoot("tier6-state-update-");
  try {
    writeFileSync(
      join(root, ".webnovel", "state.json"),
      JSON.stringify({ project_info: {}, protagonist_state: {} }),
    );
    const { updateProjectIdeation, readProjectIdeation } = await import("../../lib/projects/state.js");
    const out = await updateProjectIdeation(root, {
      title: "  T6 cov  ",
      genre: "都市异能",
      targetChapters: 1500,
      protagonistName: "  林岚  ",
    });
    assert.equal(out.title, "T6 cov", "title is trimmed");
    assert.equal(out.protagonistName, "林岚", "protagonist name trimmed");
    assert.equal(out.targetChapters, 1500);

    const reread = await readProjectIdeation(root);
    assert.equal(reread.title, "T6 cov", "persisted to disk");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
