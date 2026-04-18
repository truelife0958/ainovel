/**
 * Returns the next auto-save backoff delay (in ms) given the number of
 * consecutive failures observed so far.
 *
 * Schedule: 30s → 60s → 120s → 300s (capped).
 *
 * @param {number} failures count of consecutive failures (0-indexed)
 * @returns {number} delay in milliseconds
 */
export function computeNextBackoffMs(failures) {
  const table = [30000, 60000, 120000, 300000];
  const idx = Math.min(Math.max(0, failures), table.length - 1);
  return table[idx];
}
