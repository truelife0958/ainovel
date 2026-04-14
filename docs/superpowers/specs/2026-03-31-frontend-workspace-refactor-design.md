# Frontend Workspace Refactor Design

## Background

The current frontend workspace implementation has two clear hotspots:

- `components/writing-studio.tsx` mixes document CRUD state, chapter-sidecar state, AI action orchestration, derived diagnostics, and four major UI panels in one client component.
- `components/document-workspace.tsx` reimplements much of the same document-selection, create, save, and AI action flow with slightly different wording and rendering.

This causes three practical problems:

1. Shared behavior is duplicated in two places, so even small fixes require editing multiple components.
2. `WritingStudio` is hard to reason about because generic document workflow and chapter-specific logic are tangled together.
3. UI consistency drifts because message handling, empty states, and pending behavior are maintained separately.

The goal of this refactor is to remove the duplicated frontend workflow without forcing chapter-specific behavior into an over-general abstraction.

## Goals

- Extract a shared document workspace control layer for list selection, create, save, and baseline AI actions.
- Keep chapter-specific behavior isolated to the writing studio path.
- Reduce the size and responsibility count of `components/writing-studio.tsx` and `components/document-workspace.tsx`.
- Standardize small interaction details such as save status wording, empty states, and pending button behavior.
- Preserve existing page entry points and backend API contracts.

## Non-Goals

- No changes to `app/api/**` contracts.
- No changes to `lib/projects/**`, `lib/ai/**`, or provider behavior beyond what existing frontend consumers already expect.
- No attempt to build a schema-driven universal editor framework.
- No redesign of page information architecture.
- No large visual redesign; only minor copy and interaction cleanups are allowed.

## Recommended Approach

Use a medium-strength abstraction:

- Extract a shared workspace controller and shared workspace UI primitives for generic document workflow.
- Keep chapter-only sidecars such as brief data, context data, repair actions, and write-guard logic outside the shared controller.

This avoids both extremes:

- It is stronger than a pure JSX split, so duplicated request and state logic actually disappears.
- It is weaker than a fully generic framework, so chapter-specific rules do not leak into every other document workspace.

## Architecture

### 1. Shared Workspace Layer

Add a new `components/workspace/` directory that contains the generic document workflow pieces.

#### `components/workspace/use-project-document-controller.ts`

Responsibility:

- Own the generic document resource state:
  - `documents`
  - `selectedDocument`
  - `draftContent`
  - `newTitle`
  - `assistantRequest`
  - `message`
  - `isPending`
- Expose the generic actions:
  - select document
  - create document
  - save document
  - run configured AI action
- Normalize generic success and failure messages so `DocumentWorkspace` and `WritingStudio` do not each invent their own variants.

Important constraints:

- This hook only manages the main document resource.
- It must not know about chapter brief parsing, chapter context fetching, repair recommendations, or write-guard state.
- It should work with existing `ProjectDocumentKind`, `ProjectDocumentMeta`, and `ProjectDocument` types instead of introducing a parallel data model.

#### `components/workspace/document-sidebar.tsx`

Responsibility:

- Render the left rail used by both workspace variants:
  - optional helper summary block
  - create form
  - document list
  - selected-item highlighting
  - consistent empty state

This component should be presentational. It should receive state and callbacks from the controller rather than own request logic.

#### `components/workspace/document-editor-shell.tsx`

Responsibility:

- Provide a reusable editor card shell:
  - title and metadata header
  - save button slot
  - content area slot
  - empty state fallback
  - optional footer note

This keeps `DocumentWorkspace` and `WritingStudio` from each rebuilding the same editor framing.

#### `components/workspace/document-assistant-panel.tsx`

Responsibility:

- Render the generic assistant panel used by `DocumentWorkspace`.
- Accept action configuration and delegate actual execution to the shared controller.
- Standardize placeholder, disabled behavior, and note rendering for non-chapter workspaces.

This panel stays intentionally generic. It should not contain chapter-only controls.

### 2. Writing Studio Layer

Add a new `components/writing-studio/` directory that contains the chapter-only pieces.

#### `components/writing-studio/use-writing-sidecars.ts`

Responsibility:

- Own chapter sidecar state:
  - `brief`
  - `briefContent`
  - `context`
  - `writeGuardArmed`
  - selected repair request
  - initial assistant request application guard
- Refresh sidecar resources when the selected chapter changes.
- Provide chapter-only operations:
  - save brief
  - refresh brief/context
  - run chapter AI flow around brief/context updates

Important constraints:

- This hook composes with the shared document controller instead of replacing it.
- It should treat the selected chapter file as the synchronization key.
- It should not re-own the generic document list or document body save flow.

#### `components/writing-studio/brief-panel.tsx`

Responsibility:

- Render chapter brief editing.
- Render brief preview items.
- Render validation summary and warnings.

All derived brief diagnostics should move into this panel or a close helper so the top-level studio component stops accumulating diagnostic constants.

#### `components/writing-studio/assistant-panel.tsx`

Responsibility:

- Render chapter-specific assistant controls:
  - chapter-plan action
  - chapter-write action
  - recommended repair action
  - secondary repair action picker
  - write-guard confirmation state
- Show the chapter assistant notes computed from existing focus helpers.

This panel consumes generic controller state plus writing-sidecar state, but owns chapter-only interaction rules.

#### `components/writing-studio/context-panel.tsx`

Responsibility:

- Render chapter context sections:
  - outline
  - previous summaries
  - state summary
  - guidance items

This keeps context rendering separate from both generic workspace code and chapter brief code.

### 3. Thin Composition Components

#### `components/document-workspace.tsx`

After refactor this becomes a thin composition layer that:

- initializes the shared controller
- computes existing focus strings
- passes configuration into shared UI primitives
- optionally renders the generic assistant panel

It should stop owning raw request logic for select/create/save/AI.

#### `components/writing-studio.tsx`

After refactor this becomes a chapter-specific composition layer that:

- initializes the shared document controller for chapter documents
- initializes writing sidecars
- arranges shared sidebar + chapter-specific panels
- delegates generic work to the shared controller
- delegates chapter-only work to the writing-sidecar hook and chapter panels

It should stop directly holding all request branches and most large derived-state blocks.

## File Plan

### New Files

- `components/workspace/use-project-document-controller.ts`
- `components/workspace/document-sidebar.tsx`
- `components/workspace/document-editor-shell.tsx`
- `components/workspace/document-assistant-panel.tsx`
- `components/writing-studio/use-writing-sidecars.ts`
- `components/writing-studio/brief-panel.tsx`
- `components/writing-studio/assistant-panel.tsx`
- `components/writing-studio/context-panel.tsx`

### Modified Files

- `components/document-workspace.tsx`
- `components/writing-studio.tsx`

### Unchanged Entry Points

- `app/library/page.tsx`
- `app/outline/page.tsx`
- `app/writing/page.tsx`

These page files should keep their current data-loading role and continue passing initial data into client components.

## Data Flow

### Generic Workspace Flow

1. Page-level server component loads initial documents and initial selected document.
2. Shared controller receives that initial state.
3. Shared controller owns:
   - current document selection
   - editable draft content
   - create title input
   - assistant request input
   - generic status message
   - pending status
4. Shared UI components render based on controller state and call controller actions.

### Writing Studio Flow

1. Page-level server component loads initial chapter document, initial brief, and initial context.
2. Shared controller owns the chapter document list and chapter body editing state.
3. Writing-sidecar hook owns brief and context state keyed by `selectedDocument.fileName`.
4. When the selected chapter changes:
   - shared controller updates `selectedDocument`
   - writing-sidecar hook fetches matching brief and context
   - writing-sidecar hook resets chapter-only transient state such as write-guard confirmation and selected repair action
5. When chapter AI succeeds:
   - if target is brief, writing-sidecar state updates from the returned brief
   - if target is document, shared controller updates the document content and list
   - writing-sidecar hook refreshes context after the operation

This split keeps the main resource flow generic while keeping chapter sidecars explicit and isolated.

## Interaction Cleanup

Minor UX cleanup is allowed as part of the refactor, but only in ways that support consistency and maintainability.

Planned cleanup:

- Use shorter, more consistent success and error messages across workspace actions.
- Align pending behavior so action buttons consistently disable during in-flight requests.
- Keep empty states consistent between generic workspaces and the writing workspace.
- Remove wording drift where one screen says "save" and another says a different status phrase for the same underlying action.

Not planned:

- No major layout changes.
- No visual redesign of card hierarchy.
- No additional features unrelated to the workspace split.

## Risks and Mitigations

### Risk 1: Chapter Sidecars Drift Out of Sync

Symptom:

- User switches chapters and sees stale brief/context data from the previous selection.

Mitigation:

- Bind sidecar refresh to the selected chapter file name.
- Keep sidecar refresh logic in one dedicated hook instead of scattering it across `useEffect` blocks in multiple components.

### Risk 2: Shared Message State Becomes Ambiguous

Symptom:

- Generic save/create messages and chapter-specific AI/repair messages overwrite each other in confusing ways.

Mitigation:

- Treat controller message as the default generic status channel.
- Let writing-sidecar logic explicitly replace the message only for chapter-only operations that need custom wording.
- Keep one visible message source per rendered panel section.

### Risk 3: Over-Abstraction

Symptom:

- The shared layer becomes a dumping ground for chapter-specific branches.

Mitigation:

- Shared controller only handles main document resource workflow.
- Any feature requiring brief parsing, context fetching, repair actions, or write guard remains in the writing-specific layer.

### Risk 4: Behavioral Regression During Extraction

Symptom:

- Existing create/save/select/AI behavior changes during the move.

Mitigation:

- Preserve API payload shape and existing route usage.
- Add dedicated tests for the controller before trusting the refactor.
- Run the existing node test suite after implementation.

## Testing Strategy

### New Tests

Add controller-focused tests that cover:

- selecting a different document
- creating a document successfully
- handling create failures
- saving a document successfully
- handling save failures
- running a generic AI action successfully
- handling AI action failures

If feasible without overfitting implementation details, add a writing-sidecar test that covers:

- switching selected chapter refreshes brief and context state
- chapter-only transient state resets on selection changes

### Existing Verification

Run the existing suite:

- `npm test`

This remains the baseline regression check because the refactor is expected to preserve backend behavior.

## Rollout Notes

- Implement the shared controller first and wire `DocumentWorkspace` to it.
- Once the generic layer is stable, move `WritingStudio` onto the same controller and then extract sidecars.
- Keep the refactor incremental so failures can be isolated to either the generic workspace path or the chapter-specific path.

## Success Criteria

The refactor is considered successful when all of the following are true:

- `components/document-workspace.tsx` is primarily composition and configuration code.
- `components/writing-studio.tsx` no longer owns the full generic document workflow.
- Shared document workflow exists in one place.
- Chapter-only logic remains outside the generic shared controller.
- The existing test suite still passes after the change.
- The resulting structure is easier to extend without reopening the same duplication problem.
