# Bestseller Mechanism Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate bestseller-mechanism extraction and originality guardrails into the existing `webnovel-init` and `webnovel-plan` workflow docs.

**Architecture:** Keep the change doc-first and workflow-level. Add one shared reference file as the rule source, extend `webnovel-init` to collect and persist a lightweight `bestseller_mechanism_profile`, and extend `webnovel-plan` to inherit that profile and emit originality checks without changing Python schemas or commands.

**Tech Stack:** Markdown workflow docs, Claude skill docs, existing `.webnovel/idea_bank.json` contract

---

### Task 1: Add Shared Bestseller Mechanism Guide

**Files:**
- Create: `.claude/references/bestseller-mechanism-guide.md`

- [ ] **Step 1: Draft the reference structure**

Add sections for:
- purpose and scope
- allowed mechanism dimensions
- forbidden reuse dimensions
- lightweight output field definitions
- init-stage usage
- plan-stage usage

- [ ] **Step 2: Write the guide content**

Include explicit rules that only mechanisms can be borrowed, while characters, world devices, key twists, signature scenes, and wording cannot be reused.

- [ ] **Step 3: Verify the new reference exists and is readable**

Run: `sed -n '1,240p' .claude/references/bestseller-mechanism-guide.md`
Expected: file prints with the required sections and field names.

### Task 2: Extend `webnovel-init` Workflow

**Files:**
- Modify: `.claude/skills/webnovel-init/SKILL.md`

- [ ] **Step 1: Add the shared reference into the loading map**

Update the reference list and loading guidance so `webnovel-init` can explicitly load `../../references/bestseller-mechanism-guide.md` when entering the new phase.

- [ ] **Step 2: Insert the bestseller mechanism extraction phase**

Add a new phase before creative constraint packaging that:
- collects `3-5` reference titles
- allows fewer than `3` only with a “sample size insufficient” note
- extracts cross-title mechanisms only
- generates originality guardrails

- [ ] **Step 3: Add structured output requirements**

Document the `bestseller_mechanism_profile` block with:
- `reference_titles`
- `market_mechanisms`
- `opening_hooks`
- `power_growth_patterns`
- `coolpoint_patterns`
- `chapter_end_hook_patterns`
- `relationship_tension_patterns`
- `originality_guardrails`

- [ ] **Step 4: Add skip/failure behavior**

Document:
- skip allowed when user provides no references
- insufficient sample warning when under `3` references
- hard reset when the analysis drifts into plot-copying

- [ ] **Step 5: Verify the updated init workflow text**

Run: `rg -n "bestseller|爆款|originality_guardrails|idea_bank" .claude/skills/webnovel-init/SKILL.md`
Expected: hits show the new phase, reference, and output block.

### Task 3: Extend `webnovel-plan` Workflow

**Files:**
- Modify: `.claude/skills/webnovel-plan/SKILL.md`

- [ ] **Step 1: Add the shared reference to plan references**

Update the references section so planning can load the same shared bestseller guide.

- [ ] **Step 2: Add mechanism-profile ingestion**

Document that when `.webnovel/idea_bank.json` contains `bestseller_mechanism_profile`, planning must read it before generating beat sheets and chapter batches.

- [ ] **Step 3: Add required output sections**

Require plan output to contain:
- `爆款机制继承`
- `原创差异化校验`

Both sections must be described concretely enough to guide volume and chapter generation.

- [ ] **Step 4: Add originality guardrail checks**

Require explicit checks against:
- copied relationship skeletons
- copied world devices
- copied twists/payoffs
- copied signature scenes or wording

- [ ] **Step 5: Verify the updated plan workflow text**

Run: `rg -n "爆款机制继承|原创差异化校验|bestseller_mechanism_profile|idea_bank" .claude/skills/webnovel-plan/SKILL.md`
Expected: hits show inheritance and originality-check requirements.

### Task 4: Clarify User-Facing Positioning

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a short positioning note to README**

Insert one concise statement that the system supports mechanism-level bestseller learning for original output and is not a ghostwriting imitation tool.

- [ ] **Step 2: Add the same boundary to project guidance**

Add a matching note to `CLAUDE.md` near the project overview or workflow overview so agents see the same rule.

- [ ] **Step 3: Verify both docs mention the boundary**

Run: `rg -n "不是仿写工具|原创输出|机制借鉴" README.md CLAUDE.md`
Expected: both files contain the new statement.

### Task 5: Perform Consistency Verification

**Files:**
- Modify: none

- [ ] **Step 1: Check shared field names stay aligned**

Run: `rg -n "reference_titles|market_mechanisms|opening_hooks|power_growth_patterns|coolpoint_patterns|chapter_end_hook_patterns|relationship_tension_patterns|originality_guardrails|bestseller_mechanism_profile" .claude/references/bestseller-mechanism-guide.md .claude/skills/webnovel-init/SKILL.md .claude/skills/webnovel-plan/SKILL.md`
Expected: all files use the same field names.

- [ ] **Step 2: Check workflow references resolve**

Run: `find .claude/references -maxdepth 2 -type f | sort`
Expected: new guide appears at the documented path.

- [ ] **Step 3: Review the final diff manually**

Run: `sed -n '1,260p' .claude/references/bestseller-mechanism-guide.md` and inspect the modified sections of the two skill docs plus README/CLAUDE.
Expected: documentation is internally consistent and remains platform-agnostic.

