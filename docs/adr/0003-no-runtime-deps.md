# 3. Zero non-framework runtime dependencies

Date: 2026-03-24

## Status

Accepted

## Context

The app is meant to be cloned by individual authors and run locally
forever. Every runtime dependency is a future supply-chain risk, a
future breaking change, and a few hundred kilobytes of bundle. The
Node / React / Next.js trio is enough to build a rich editor.

## Decision

Only `next`, `react`, and `react-dom` may appear in `dependencies`.
Anything else (Markdown rendering, SVG math, formatting, testing,
logging) is either hand-written (~100-500 lines per feature) or a
devDependency.

## Consequences

- **Positive:** `npm audit` is quiet; updates are predictable; the
  editor loads fast; the Markdown preview renderer (custom, ~90
  lines) is auditable in one sitting.
- **Negative:** reinventing small utilities (focus trap, chapter
  search, Markdown render, logger, ring math) costs engineering time;
  the Markdown renderer is minimal and may miss edge cases (e.g.
  nested parentheses inside link URLs).
- **Neutral:** devDependencies (TypeScript, Playwright,
  testing-library, linkedom, axe-core) are acceptable because they
  never ship to end users.
