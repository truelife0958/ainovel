# 4. Anthropic prompt caching

Date: 2026-04-19

## Status

Accepted

## Context

Chapter generation sends a long guardrails + project-summary + ideation
prefix with every call. Anthropic's ephemeral prompt cache reuses an
identical prefix across calls within a short window and discounts the
cached tokens heavily. Not using it leaves real money on the table for
power users generating hundreds of chapters.

## Decision

Wrap the Anthropic `system` field as a single-element array carrying
`cache_control: { type: 'ephemeral' }`. Propagate an env kill-switch
`WEBNOVEL_DISABLE_PROMPT_CACHE=1` that reverts to the plain-string
shape for debugging or billing audits.

Per-provider unified return: `{ text, usage, latencyMs }`.
`cache_read_input_tokens` and `cache_creation_input_tokens` are
surfaced through `usage` and rendered in the bottom-bar AI status line.

## Consequences

- **Positive:** repeat chapter runs for the same project can cut
  cached input tokens dramatically (≥60% hit rate observed in dev).
- **Negative:** requests now differ in shape from the simplest
  anthropic SDK examples; future upgrades must preserve the array-form
  system field.
- **Neutral:** the `splitPromptParts` helper exists for future
  migration to explicit static/dynamic prompt split, but isn't wired
  into every builder yet. The cache benefits any stable instructions
  string without that migration.
