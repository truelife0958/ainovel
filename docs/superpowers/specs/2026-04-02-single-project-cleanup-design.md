# Single-Project Aggressive Cleanup Design

**Date:** 2026-04-02

**Goal**

Collapse the repository into a single-project web product that only preserves the runtime paths required for `npm run dev`, `npm run build`, and real content generation against the bundled `webnovel-project/` directory.

This document uses the aliases below for the real project directories under `webnovel-project/`:

- settings-dir: the project settings documents directory
- outlines-dir: the project outline documents directory
- chapters-dir: the project chapter documents directory

The implementation must continue reading and writing the real existing directories, not introduce a new storage layout.

## Scope

This cleanup treats the repository as a product runtime, not a development workspace. The target state is:

- one Next.js app
- one fixed project root: `webnovel-project/`
- one content generation chain covering ideation, settings, outline editing, chapter writing, and real AI output
- no multi-project workspace behavior
- no review or observability console
- no test, delivery, or legacy workflow assets unless directly required by runtime

The cleanup is intentionally aggressive. Large structural changes, broad deletions, route removals, module moves, and compatibility breaks are acceptable if the final product still satisfies the runtime goal.

## Product Surface

### Pages To Keep

- `/ideation`
- `/library`
- `/outline`
- `/writing`
- `/settings`

### Pages To Remove

- `/dashboard`
- `/review`

### Entry Route

`/` will redirect to `/writing`.

Rationale:

- `dashboard` exists mainly to create, list, and switch projects. That product surface becomes meaningless once the app is fixed to a single bundled project root.
- `review` depends on workflow and observability artifacts that are not part of the minimum runtime generation chain.
- `/writing` is the most direct product entry and should become the default landing route.

## Fixed Project Model

The app will stop discovering projects from the workspace and stop reading `.claude/.webnovel-current-project`.

Instead, the product will resolve a single project root:

- `webnovel-project/`

All page loaders and API routes will read and write against that fixed location.

If `webnovel-project/.webnovel/state.json` is missing, the app should fail with a clear single-project runtime error rather than falling back to workspace onboarding or project discovery.

## Data That Must Remain Real

The cleanup must preserve real generated content and real editable project artifacts in `webnovel-project/`.

Required content locations:

- `webnovel-project/.webnovel/state.json`
- `webnovel-project/.webnovel/briefs`
- `webnovel-project/.webnovel/summaries`
- the real settings-dir under `webnovel-project/`
- the real outlines-dir under `webnovel-project/`
- the real chapters-dir under `webnovel-project/`

Optional runtime data:

- `webnovel-project/.webnovel/idea_bank.json` if already referenced by surviving product logic

Data explicitly allowed to be removed:

- `webnovel-project/.git`
- `webnovel-project/.webnovel/index.db`
- `webnovel-project/.webnovel/workflow_state.json`
- `webnovel-project/.webnovel/observability/`
- `webnovel-project/.webnovel/archive/`
- `webnovel-project/.webnovel/backups/`

## Target Architecture

### App Layer

The Next.js app remains the runtime shell, but the navigation and route tree shrink to the five kept pages.

Navigation will only contain:

- ideation
- library
- outline
- writing
- settings

All headers, empty states, and copy that currently assume project switching or project absence will be rewritten to single-project semantics.

### API Layer

Current API naming is tied to the removed multi-project model. The runtime API surface will be renamed and reduced.

#### Keep And Rename

- `/api/projects/current/ideation` to `/api/project/ideation`
- `/api/projects/current/documents` to `/api/project/documents`
- `/api/projects/current/briefs` to `/api/project/briefs`
- `/api/projects/current/context` to `/api/project/context`
- `/api/projects/current/actions` to `/api/project/actions`

#### Keep As-Is

- `/api/settings/providers`

#### Remove Entirely

- `/api/projects`
- `/api/projects/current`
- `/api/projects/current/review`

The remaining client components will be updated to call the new single-project endpoints only.

### Service Layer

The current `lib/projects/*` area mixes real content services with workspace discovery and project switching abstractions. That boundary will be replaced with a single-project service area:

- `lib/project/root.js`
- `lib/project/summary.js`
- `lib/project/documents.js`
- `lib/project/ideation.js`
- `lib/project/briefs.js`
- `lib/project/context.js`
- `lib/project/sync.js`

Responsibilities:

- `root.js`
  resolve and validate the fixed `webnovel-project/` root
- `summary.js`
  build summary data used by headers and page-level overview text
- `documents.js`
  read, list, create, and update markdown files under the real settings, outline, and chapter directories
- `ideation.js`
  read and update ideation fields in `.webnovel/state.json`
- `briefs.js`
  read and update chapter task briefs in `.webnovel/briefs`
- `context.js`
  build chapter context for the writing page from local project files
- `sync.js`
  keep `.webnovel/chapter_meta` and `.webnovel/summaries` synchronized with brief and chapter edits

Modules to delete:

- `lib/projects/workspace.js`
- multi-project discovery logic in `lib/projects/discovery.js`
- `lib/projects/review.js`
- `lib/dashboard/*`
- `lib/review/*`

The old `lib/projects/*` files that still contain necessary document, brief, state, or sync logic may be migrated or rewritten under `lib/project/*`, but the final runtime should not retain workspace-driven naming or behavior.

## Context Generation Strategy

The current writing context path calls `.claude/scripts/extract_chapter_context.py`, which is a large Python-based legacy dependency chain.

That Python path will not be preserved as a product dependency.

`lib/project/context.js` will become a pure JavaScript runtime implementation that assembles chapter context from:

- the real outline directory under `webnovel-project/`
- `webnovel-project/.webnovel/summaries`
- `webnovel-project/.webnovel/state.json`

The JavaScript implementation only needs to preserve the product behavior that matters to writing:

- current chapter outline snippet when available
- previous chapter summaries when available
- compact project state summary
- simple guidance items derived from local data

It does not need to preserve the full Python, RAG, or context-manager feature set.

If a context fragment cannot be found, the endpoint should degrade to empty or minimal values, not fail the page.

## AI Prompt Assets

`lib/ai/actions.js` currently reads guardrail text from `.claude/references/bestseller-mechanism-guide.md`.

That dependency will be internalized into the runtime codebase as a local JS module or constant string under `lib/ai/`, so the product no longer depends on `.claude/references`.

The surviving AI flow must still support:

- outline planning
- chapter planning
- chapter writing

The surviving AI flow does not need to preserve legacy CLI or `.claude` workflow compatibility.

## Route And Component Changes

### Remove

- `app/dashboard`
- `app/review`
- `components/project-workspace-panel.tsx`
- `components/review-summary-panel.tsx`
- dashboard-specific and review-specific focus helpers and types

### Keep And Rewire

- `app/ideation`
- `app/library`
- `app/outline`
- `app/writing`
- `app/settings`
- `components/app-shell.tsx`
- `components/document-workspace.tsx`
- `components/ideation-form.tsx`
- `components/provider-settings-form.tsx`
- `components/writing-studio.tsx`

Rewire requirements:

- remove all assumptions about project switching
- remove null-current-project onboarding branches where possible
- load the fixed project summary directly
- replace calls to `/api/projects/current/*` with `/api/project/*`

## Repository Deletion Plan

The cleanup should delete entire categories of repository content that are no longer required for runtime.

### Delete Runtime Artifacts

- `.next`
- `.next-manual-inspect`
- `.next-playwright`
- `.playwright`
- `playwright-report`
- `test-results`
- `.coverage`
- `tsconfig.tsbuildinfo`

### Delete Test And QA Assets

- `tests`
- `playwright.config.mjs`
- `pytest.ini`
- `.coveragerc`

### Delete Legacy Workflow Assets

- `.claude`
- `scripts`

### Delete Delivery And Process Documents

- delivery-oriented content under `docs/`, except the spec and any documentation intentionally retained for the slim runtime
- `CHANGELOG.md`

### Package Script Reduction

`package.json` will be reduced to the minimum supported runtime scripts:

- `dev`
- `build`
- `start`

Test scripts and Playwright scripts will be removed.

## Error Handling

The slim product must fail clearly and narrowly.

Required behaviors:

- missing fixed project root:
  return a clear single-project runtime error
- missing document files:
  return empty lists or explicit document-not-found errors depending on endpoint intent
- missing brief or summary files:
  synthesize default brief content or empty summaries
- missing API key:
  allow local editing paths to function and return a clear AI-unavailable message for generation actions
- missing outline or state fragments during context building:
  degrade context content rather than failing the page

The product no longer needs to handle:

- switching to another project
- invalid workspace pointers
- scanning sibling directories for compatible projects
- workflow or observability file absence for review pages

## Acceptance Criteria

The cleaned repository is acceptable when all of the following are true:

1. `npm run dev` starts successfully.
2. `npm run build` completes successfully.
3. The app exposes only the single-project runtime surface.
4. The app reads and writes real files under `webnovel-project/`.
5. The settings page still allows saving provider configuration.
6. The outline page still supports real AI planning output when a provider key exists.
7. The writing page still supports:
   - chapter creation
   - brief editing
   - chapter body editing
   - chapter context display
   - real AI chapter planning
   - real AI chapter writing
8. No runtime code path depends on project discovery, project switching, Playwright, tests, review observability, or `.claude` assets.

## Non-Goals

The cleanup explicitly does not preserve:

- multi-project compatibility
- review dashboard behavior
- workflow history visualizations
- observability log reading
- Python-based enhanced context extraction
- Playwright and Node test coverage
- legacy CLI or `.claude` workflow documentation

## Risk Profile

Accepted risks:

- broad route and import breakage during refactor
- copy regressions while removing null-project and workspace states
- reduced chapter-context richness after dropping the Python path
- deletion of development assets that were previously useful outside product runtime

Risks that are not acceptable:

- breaking `npm run dev`
- breaking `npm run build`
- losing real content editing in `webnovel-project/`
- breaking AI write or plan actions when provider configuration is valid

## Implementation Direction

The implementation should proceed in this order:

1. introduce fixed single-project root resolution
2. migrate page loaders and APIs to single-project services
3. rename API routes and update client fetch calls
4. remove dashboard and review surfaces
5. replace Python context extraction with JavaScript context aggregation
6. internalize AI guardrail text
7. delete test, docs, legacy workflow, and runtime artifact directories
8. trim package scripts
9. verify `npm run dev` and `npm run build`
