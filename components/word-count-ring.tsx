"use client";

import { ringGeometry } from "@/lib/ui/word-count-ring.js";

type WordCountRingProps = {
  current: number;
  target: number;
  size?: number;
};

export function WordCountRing({ current, target, size = 24 }: WordCountRingProps) {
  const r = (size - 4) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const { dashArray, dashOffset, ratio, over } = ringGeometry(current, target, r);
  const pct = Math.round(ratio * 100);
  const label = target > 0
    ? `${current} / ${target} 字 (${pct}%)`
    : `${current} 字`;
  return (
    <span className="word-count-ring" title={label} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={2}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={over ? "var(--warning)" : "var(--accent)"}
          strokeWidth={2}
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
    </span>
  );
}
