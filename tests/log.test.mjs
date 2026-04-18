import { test } from "node:test";
import assert from "node:assert/strict";

test("log.info writes a single-line JSON to stdout in production", async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalWrite = process.stdout.write.bind(process.stdout);
  const lines = [];
  // @ts-ignore test-only override
  process.stdout.write = (chunk) => {
    if (typeof chunk === "string") lines.push(chunk);
    return true;
  };
  process.env.NODE_ENV = "production";
  try {
    const { log } = await import("../lib/log.js?t=" + Date.now());
    log.info("test_event", { foo: "bar", n: 42 });
    assert.equal(lines.length, 1, "one line written");
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.level, "info");
    assert.equal(parsed.event, "test_event");
    assert.equal(parsed.foo, "bar");
    assert.equal(parsed.n, 42);
    assert.ok(parsed.ts);
  } finally {
    process.stdout.write = originalWrite;
    process.env.NODE_ENV = originalEnv;
  }
});

test("log.error in test env is a silent no-op", async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  let wrote = false;
  // @ts-ignore test-only override
  process.stdout.write = () => { wrote = true; return true; };
  // @ts-ignore test-only override
  process.stderr.write = () => { wrote = true; return true; };
  process.env.NODE_ENV = "test";
  try {
    const { log } = await import("../lib/log.js?t=" + Date.now());
    log.error("should_be_silent", { x: 1 });
    assert.equal(wrote, false, "no output in test env");
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    process.env.NODE_ENV = originalEnv;
  }
});

test("log.warn in development writes colored output", async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalWrite = process.stdout.write.bind(process.stdout);
  const lines = [];
  // @ts-ignore
  process.stdout.write = (chunk) => {
    if (typeof chunk === "string") lines.push(chunk);
    return true;
  };
  process.env.NODE_ENV = "development";
  try {
    const { log } = await import("../lib/log.js?t=" + Date.now());
    log.warn("dev_warning", { code: "X" });
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes("dev_warning"));
    assert.ok(lines[0].includes("\x1b["));
  } finally {
    process.stdout.write = originalWrite;
    process.env.NODE_ENV = originalEnv;
  }
});
