/**
 * Compute stroke-dasharray / offset for a progress ring. The circumference
 * is `2 * π * radius`. `ratio` is clamped to [0, 1]; `over` is true iff
 * current > target.
 *
 * @param {number} current
 * @param {number} target
 * @param {number} radius
 * @returns {{ dashArray: number, dashOffset: number, ratio: number, over: boolean }}
 */
export function ringGeometry(current, target, radius) {
  const circ = 2 * Math.PI * radius;
  const effectiveTarget = Math.max(1, Number(target) || 0);
  const safeCurrent = Math.max(0, Number(current) || 0);
  const ratio = Math.min(1, safeCurrent / effectiveTarget);
  return {
    dashArray: circ,
    dashOffset: circ * (1 - ratio),
    ratio,
    over: safeCurrent > effectiveTarget,
  };
}
