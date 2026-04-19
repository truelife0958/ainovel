# 5. Risk-tiered polish (Tier 1 / Tier 2 / Tier 3)

Date: 2026-04-19

## Status

Accepted

## Context

The April polish project bundled 26+ individual changes across
correctness, features, and documentation. Shipping them together
would have blocked review, mixed rollback surfaces (a bad ErrorBoundary
change could block a perfectly fine export feature), and produced a
mega-PR no reviewer wants to touch.

## Decision

Split into three tiers landed in sequence, each behind a git tag:

- **`polish-tier-1`** — correctness & resilience (10+ items); safest
  layer to roll back first if anything regresses. Auto-save retry,
  save-path unify, AbortController, batch scheduler, focus trap,
  dirty-close confirm, ErrorBoundary, etc.
- **`polish-tier-2`** — value features (8 items); behind a
  `WEBNOVEL_DISABLE_PROMPT_CACHE` kill-switch for the caching change.
  Prompt caching, AI cancel, telemetry, Markdown preview, search,
  export, word-count ring.
- **`polish-tier-3`** — quality foundation (10 items, pure additions);
  safe to keep even if earlier tiers revert. Structured logger,
  request-id middleware, E2E + a11y suite, ARCHITECTURE /
  CONTRIBUTING / ADRs, CHANGELOG + README upgrade.

Each tier has its own spec + plan under `docs/superpowers/` and its
own commit range.

## Consequences

- **Positive:** independent rollback; reviewer sees three coherent
  commit stacks instead of one mega-PR; failure in one tier doesn't
  stall the next.
- **Negative:** slightly more ceremony (three commit ranges, three
  tags) than a single merge would require.
- **Neutral:** follow-up polish cycles can reuse the same structure
  by following CONTRIBUTING.md and the spec/plan templates.
