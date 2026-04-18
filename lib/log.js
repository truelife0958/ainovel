/**
 * Structured logger. In production writes one JSON line per call to
 * stdout; in development writes a colored line; in test env it is a
 * silent no-op so unit tests don't spam when they intentionally trigger
 * error paths.
 *
 * @typedef {Record<string, unknown>} LogFields
 * @typedef {"info" | "warn" | "error"} LogLevel
 */

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function emit(level, event, fields) {
  if (process.env.NODE_ENV === "test") return;
  const record = { ts: new Date().toISOString(), level, event, ...(fields ?? {}) };
  if (process.env.NODE_ENV === "production") {
    process.stdout.write(JSON.stringify(record) + "\n");
    return;
  }
  const color = level === "error" ? RED : level === "warn" ? YELLOW : CYAN;
  process.stdout.write(
    `${color}[${level}] ${event}${RESET} ${JSON.stringify(fields ?? {})}\n`,
  );
}

export const log = {
  /** @param {string} event @param {LogFields} [fields] */
  info: (event, fields) => emit("info", event, fields),
  /** @param {string} event @param {LogFields} [fields] */
  warn: (event, fields) => emit("warn", event, fields),
  /** @param {string} event @param {LogFields} [fields] */
  error: (event, fields) => emit("error", event, fields),
};
