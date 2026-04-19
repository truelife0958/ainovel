# Architecture

Webnovel Writer is a single-page Next.js 16 + React 19 app that sits on
top of a local filesystem-backed project store. It speaks to nine AI
providers through a thin adapter layer and exposes a modal-based UI so
every feature is one click from the editor.

## Layered view

```
┌───────────────────────────────────────────────────┐
│ UI layer                                          │
│   AppShell  →  Toolbar / BottomBar / Modals       │
│   CreativeWorkspace (editor + brief + preview)    │
└──────────────────────┬────────────────────────────┘
                       │  fetch(/api/...)
┌──────────────────────▼────────────────────────────┐
│ API routes (app/api/**/route.ts)                  │
│   rate-limit → sanitize → call lib → catch+log    │
└──────────────────────┬────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────┐
│ lib/                                              │
│   ai/       providers · actions · telemetry        │
│   projects/ discovery · docs · briefs · sync       │
│   api/      rate-limit · sanitize · abort hook     │
│   settings/ encryption · provider-config           │
│   ui/       focus-trap · chapter-search · ring math│
│   log.js    structured logger                      │
└──────────────────────┬────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────┐
│ Local filesystem (~/.webnovel-writer, project dir)│
│   state.json · index.db · chapters/ · outlines/   │
└───────────────────────────────────────────────────┘
```

## Key patterns

**Single-page modal shell.** `components/app-shell.tsx` holds the
top toolbar, bottom bar, and every modal as sibling portals. No route
changes ever navigate away from `/`; feature surfaces open/close via
`useState`. This removes route-transition flicker and keeps editor
state alive across every interaction. See ADR 0001.

**Provider adapter layer.** `lib/ai/providers.js` exposes a single
`invokeProviderModel(config, invocation)` that dispatches to the right
per-vendor caller. Every caller returns the same shape:

```js
{ text, usage, latencyMs }
```

This uniformity lets `lib/ai/telemetry.js` and the bottom-bar status
line work across all nine providers.

**Prompt caching.** The Anthropic caller wraps the `system` prompt with
`cache_control: { type: 'ephemeral' }`; `WEBNOVEL_DISABLE_PROMPT_CACHE=1`
reverts to plain strings. OpenAI-compatible providers benefit from
stable-prefix caching naturally when `instructions` doesn't change
between calls. See ADR 0004.

**AI cancellation.** `AbortController` threads from the UI
(`components/creative-workspace.tsx`) through `runDocumentAiAction`
into each provider's internal controller, so clicking "取消" aborts
the in-flight fetch and the server returns HTTP 499.

**File lock + atomic writes.** `lib/projects/file-lock.js` gates
`state.json` writes; every write goes to a temp file and renames, so a
crash mid-write never corrupts the project store.

**Security baseline.**

- AES-256-GCM encryption for provider secrets in `~/.webnovel-writer`
- Input sanitization on every API route (`lib/api/sanitize.ts`)
- Rate limiting per client IP (`lib/api/rate-limit.ts`)
- SSRF blocklist (IPv4 + IPv6 private ranges, cloud metadata endpoints)
- Provider base URL validated before every outbound call
- All responses pass through `sanitizeErrorMessage` to prevent path leaks
- `middleware.ts` injects `X-Request-Id` so server failures are traceable

See ADR 0002 for the encryption design.

**Observability.** `lib/log.js` writes single-line JSON in production,
colored lines in dev, no-op in test. Every API route's catch block
records `{ event: 'route_failed', route, requestId, error }`. The UI
error boundary emits `[react_render_error]` with an id the user can
copy.

## Claude Code subsystem

The `.claude/` directory hosts a companion writing-assistant subsystem
(agents, skills, scripts). It is **entirely outside** the webapp
runtime path — the webapp never imports `.claude/**`. Authors use both
independently: the webapp for browser-based writing, the Claude Code
skills for agentic workflows. See `CLAUDE.md` for the subsystem
details.

## Directory quick reference

```
app/                      Next.js pages + API routes
components/               React components (all client-side)
lib/                      Pure/shared server & client code
tests/                    node:test unit + Playwright e2e + axe-core
types/                    TypeScript declarations
docs/adr/                 Architecture Decision Records
docs/superpowers/         Design specs + implementation plans
.claude/                  Companion writing-assistant subsystem
middleware.ts             Request-id injection (edge runtime)
```

## When to add what

- **New page/route?** Probably not — open a modal inside AppShell
  instead. Routes exist only for API handlers.
- **New AI provider?** Add a caller to `lib/ai/providers.js`, return
  the common `{ text, usage, latencyMs }` shape, and register it in
  the `invokeProviderModel` switch.
- **New feature touching >2 files?** Write a spec under
  `docs/superpowers/specs/` and an implementation plan under
  `docs/superpowers/plans/`; follow the risk-tiered pattern (ADR 0005)
  if the change crosses correctness / features / docs.
- **Architectural decision?** Drop an ADR in `docs/adr/` using
  `TEMPLATE.md` as the starting point.
