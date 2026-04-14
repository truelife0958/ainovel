# Web App Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-first, later-packaged application shell for Webnovel Writer that turns the current workflow package into a usable personal-author product.

**Architecture:** Create a Next.js application as the product shell, keep novel projects in their current directory-based format, expose existing project data through server-side file/SQLite services, and reserve a clean boundary for later Tauri packaging. The first delivery focuses on a working browser app with the seven approved modules and API-key-based model routing.

**Tech Stack:** Next.js, React, TypeScript, SQLite, filesystem-backed project data, later Tauri-compatible architecture

---

### Task 1: Scaffold the Web Application Shell

**Files:**
- Create: `app/`
- Create: `components/`
- Create: `lib/`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.*`
- Create: `app/layout.*`
- Create: `app/page.*`

- [ ] **Step 1: Initialize the web app structure**

Create a Next.js TypeScript app structure in this repository without disturbing the existing `.claude/` workflow assets.

- [ ] **Step 2: Add a shared app shell**

Implement a global layout with:
- sidebar/top navigation
- project context header
- seven approved primary modules

- [ ] **Step 3: Add placeholder routes for all first-version modules**

Create routes for:
- project home
- ideation
- settings
- outline
- writing
- review
- app settings

- [ ] **Step 4: Run the app in development**

Run: `npm install` then `npm run dev`
Expected: local app boots and primary navigation renders.

### Task 2: Build Project Access and Data Boundaries

**Files:**
- Create: `lib/projects/*`
- Create: `app/api/projects/*`
- Modify: app routes as needed

- [ ] **Step 1: Define the project access contract**

Document and implement the rules for opening an existing novel project directory and creating a new compatible one.

- [ ] **Step 2: Add server-side project readers**

Implement server utilities that read:
- `设定集/*.md`
- `大纲/*.md`
- `正文/*.md`
- `.webnovel/state.json`
- `.webnovel/index.db`

- [ ] **Step 3: Add project mutation endpoints**

Expose safe write operations for:
- updating markdown files
- updating state JSON through controlled helpers
- reading SQLite-backed summaries

- [ ] **Step 4: Verify the project open/create loop**

Run the relevant dev route/API checks.
Expected: a user can point the app at an existing compatible project and view its data.

### Task 3: Implement the Seven Product Modules

**Files:**
- Create/modify route files under `app/`
- Create shared module components under `components/`

- [ ] **Step 1: Project Home**

Show:
- current project summary
- recent edits
- current volume/chapter
- risk reminders

- [ ] **Step 2: Ideation Workspace**

Build the visual shell for:
- project basics
- genre/reader targeting
- creative constraints
- bestseller mechanism extraction

- [ ] **Step 3: Setting Library**

Build editors/viewers for:
- world setting
- power system
- protagonist card
- team/heroine/antagonist notes

- [ ] **Step 4: Outline Workspace**

Build the shell for:
- master outline
- volume outlines
- beat sheets
- chapter plans
- scene cards
- foreshadow card entry point

- [ ] **Step 5: Writing Workspace**

Build the main chapter-writing interface with:
- task brief
- writing editor
- previous-hook / current-target panels
- entity and foreshadow side context

- [ ] **Step 6: Review Center**

Build the review dashboard with:
- review issue lists
- pacing/consistency/reader-pull summaries
- quality trend area

- [ ] **Step 7: Settings Center**

Build the model/provider settings UI and project path/config panel.

- [ ] **Step 8: Verify route-level completeness**

Run the app and click through all seven modules.
Expected: every route loads, navigation is coherent, and no module is a dead end.

### Task 4: Add Model Provider Configuration

**Files:**
- Create: `lib/providers/*`
- Create: `app/api/providers/*`
- Modify: settings UI

- [ ] **Step 1: Define provider config storage**

Store user-level application config separately from novel project data.

- [ ] **Step 2: Add provider support**

Support:
- OpenAI
- Anthropic
- OpenRouter

- [ ] **Step 3: Add model-role routing**

Allow users to assign different default models for:
- ideation
- outlining
- writing
- review

- [ ] **Step 4: Add cost-control presets**

Implement:
- 高质量
- 平衡
- 省钱

- [ ] **Step 5: Verify config persistence**

Expected: provider settings persist outside the project directory and can be reloaded across sessions.

### Task 5: Bridge Existing Workflow Intelligence into the App

**Files:**
- Create/modify: service-layer adapters under `lib/`
- Modify: relevant module pages

- [ ] **Step 1: Map current workflow capabilities to service adapters**

Create adapters for:
- init-like data preparation
- outline summaries
- review summaries
- state/index insights

- [ ] **Step 2: Use adapters in the UI instead of direct file poking**

Ensure module pages consume a stable internal service layer rather than reading raw files everywhere.

- [ ] **Step 3: Add minimal task-oriented actions**

Expose product-level actions such as:
- generate ideation draft
- generate outline draft
- generate chapter draft
- run review summary

- [ ] **Step 4: Verify that the app is workflow-centered**

Expected: the UI feels like a guided authoring product, not a generic file browser.

### Task 6: Prepare for Packaging Without Blocking Web Delivery

**Files:**
- Create: `docs/packaging/*` or equivalent implementation notes if needed
- Create placeholder Tauri integration files only if low-risk

- [ ] **Step 1: Keep desktop-sensitive logic behind boundaries**

Isolate project access, config storage, and local-system operations behind services that can later be swapped for Tauri bridges.

- [ ] **Step 2: Document the packaging seam**

Describe:
- what stays shared between Web and desktop
- what later moves behind a Tauri bridge

- [ ] **Step 3: Verify web-first assumptions**

Expected: no critical first-version feature depends on a desktop-only API.

### Task 7: Verification and Delivery Readiness

**Files:**
- Modify as needed across the app

- [ ] **Step 1: Run install/build verification**

Run:
- `npm install`
- `npm run dev`
- `npm run build`

Expected: development and production builds both succeed.

- [ ] **Step 2: Perform route smoke testing**

Verify all seven modules render and basic project opening works.

- [ ] **Step 3: Verify data compatibility**

Open the existing sample project and confirm reads from:
- markdown files
- `.webnovel/state.json`
- `.webnovel/index.db`

- [ ] **Step 4: Review first-version scope**

Confirm the result still matches:
- personal-author focus
- web-first delivery
- API-key provider model
- no team-first complexity

