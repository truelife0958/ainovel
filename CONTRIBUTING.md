# Contributing

Thanks for improving Webnovel Writer. This document covers local setup,
testing expectations, commit style, security rules, and PR checks.

## Local development

```bash
npm install
npm run dev         # http://localhost:3000
npm test            # unit tests (node:test + linkedom + RTL)
npm run test:e2e    # Playwright suite (headless)
npm run build       # production build
```

Node **≥ 20.11** is required (uses native `node:test` features). The
repo assumes a POSIX shell for some helper scripts; Windows users
should run via WSL.

## Testing expectations

- Every feature or bugfix ships with a failing-then-passing test.
- UI interactions that can't run under linkedom (anything that imports
  a `.tsx` directly) are covered by Playwright in `tests/e2e/**`.
- `npm test` and `npm run test:e2e` must both be green before merging.
- `npx tsc --noEmit` must report **0 errors**.
- Tier 3 adds `@axe-core/playwright`: don't introduce critical a11y
  violations. Non-critical findings are logged as warnings; fix them
  iteratively.

## Commit style

Conventional Commits. `scope(:subscope)? description` in the imperative
mood:

```
feat(ai): add Anthropic prompt caching
fix(a11y): trap focus inside modal on ESC
refactor(workspace): unify saveDocument path
test(e2e): add dark-mode persistence spec
docs(adr): record single-page-shell decision
chore(deps): bump @types/react
```

Include a body when the *why* isn't obvious from the subject. Large
multi-file changes should reference the design doc under
`docs/superpowers/specs/` if one exists.

## Security rules

- **Never commit real API keys.** `.env.local` is in `.gitignore`;
  keep it there. Use the Connection Wizard in-app during dev.
- **Never disable the SSRF blocklist.** If a test genuinely needs
  localhost, the allowlist already covers 127.0.0.1 in non-production.
- **Provider secrets are encrypted with AES-256-GCM.** Don't downgrade
  to plaintext storage.
- **Don't add runtime dependencies** beyond `next` / `react` /
  `react-dom` without an ADR justifying it. devDependencies are OK.
  See ADR 0003.

## Working with the polish spec + plan system

Non-trivial work lives under `docs/superpowers/`:

- `specs/YYYY-MM-DD-<topic>-design.md` — the what/why
- `plans/YYYY-MM-DD-<topic>-plan.md` — the TDD-oriented how
- Each tier ends with a `polish-tier-N` git tag for rollback

If your change touches multiple independent concerns (correctness +
features + docs), consider the risk-tiered approach from ADR 0005.

## PR checklist

- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] `npm run build` succeeds
- [ ] `CHANGELOG.md` updated (under the appropriate date heading)
- [ ] If architecture changed: add/update an ADR in `docs/adr/`
- [ ] If public-facing behavior changed: update `README.md`

## Design docs

Long-running polish projects live under `docs/superpowers/specs/` and
`docs/superpowers/plans/`. Follow the existing tier structure if you
extend them.
