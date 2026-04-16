/**
 * Shared file-level mutex for serializing read-modify-write operations.
 * Used by state.js, sync.js, and provider-config.js to prevent race conditions
 * on the same files across different modules.
 */

const locks = new Map();

export function acquireFileLock(key) {
  const lock = locks.get(key) || { queue: [], held: false };
  locks.set(key, lock);
  if (!lock.held) {
    lock.held = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => lock.queue.push(resolve));
}

export function releaseFileLock(key) {
  const lock = locks.get(key);
  if (!lock) return;
  if (lock.queue.length > 0) {
    lock.queue.shift()();
  } else {
    lock.held = false;
    locks.delete(key);
  }
}

/**
 * Atomic JSON write: write to temp file then rename.
 * Prevents corruption from crashes mid-write.
 */
export async function atomicWriteJSON(filePath, data) {
  const { mkdir, rename, writeFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const dir = resolve(filePath, "..");
  const tmpPath = filePath + ".tmp";
  await mkdir(dir, { recursive: true });
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await rename(tmpPath, filePath);
}
