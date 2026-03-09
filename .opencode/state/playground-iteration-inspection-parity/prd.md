# Playground Iteration + Inspection Parity

**Type:** Feature Plan
**Effort:** XL (>2 days)
**Branch:** `geoquant/streaming-ui` (CRITICAL: keep all implementation on this branch)
**Status:** Ready for task breakdown
**Date:** 2026-03-08

## Problem Statement

**Who:** Internal Kumo team using `/playground` to evaluate streaming generative UI quality.

**What:** The current playground is strong at A/B comparison, prompt inspection, grading, tool confirmation, and eval workflows, but it is still weak at rapid inspect-and-adjust loops. Compared with the `_inspo/json-render` playground, it lacks five high-leverage affordances: direct tree editing, nested tree inspection, a searchable catalog reference, explicit TSX export actions, and a layout that works well on mobile or under resize pressure.

**Why it matters:** The current loop is still too linear: prompt -> wait -> inspect one representation at a time. When a generation is close-but-wrong, the fastest next step is often to inspect structure, edit the tree locally, compare generated TSX, and check component/action availability without leaving the page. Missing those tools slows prompt iteration and makes quality debugging noisier than it needs to be.

**Evidence:**

- Current Kumo playground already supports richer experimentation than the inspo app in `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`, but it still lacks the iteration tooling found in `_inspo/json-render/apps/web/components/playground.tsx`.
- User explicitly asked for all missing parity items except version history.
- User explicitly chose: no route churn, no version history in v1, JSON inspect/edit only, and all work stays on `geoquant/streaming-ui`.

## Discovery

**Explored:**

- `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`
- `packages/kumo-docs-astro/src/lib/stream-jsonl-ui.ts`
- `packages/kumo-docs-astro/src/lib/playground.ts`
- `packages/kumo-docs-astro/src/components/demos/RegistryDemo.tsx`
- `packages/kumo-docs-astro/src/components/demos/_StreamingDemo.tsx`
- `packages/kumo/src/generative/ui-tree-to-jsx.ts`
- `packages/kumo/src/streaming/action-registry.ts`
- `_inspo/json-render/apps/web/components/playground.tsx`

**Key findings:**

- `_PlaygroundPage.tsx` is already the orchestration hub for chat, A/B streams, tabs, tools, skills, grading, and action logs; adding features in-place will compound complexity quickly.
- The current code already has the core primitives needed for this work: `streamJsonlUI`, `UITreeRenderer`, `uiTreeToJsx`, grading utilities, runtime value stores, and registry metadata.
- The inspo app's biggest reusable idea is not its data model but its “many views over one artifact” workflow.
- Version history would materially complicate state shape and stream lifecycle; the user chose to defer it.
- A raw text JSON editor is a better fit than copying the inspo app's visual JSON editor dependency. It matches the requested scope (`inspect + edit JSON only`) and avoids a new schema-unsound editing surface.

## Proposed Solution

Keep `/playground` and `/playground/report` intact. Do not change route structure. Extend the existing playground into a stronger inspect-and-adjust workstation built around the current A/B model.

The core architectural move is to extract panel/workspace state out of the monolithic `_PlaygroundPage.tsx` render body into a dedicated playground state module, then layer the five requested features on top of that stable shape. This preserves the current stream/tool flow while making room for new inspection surfaces.

The new experience has three layers:

1. **Resizable workspace shell**
   - Desktop: nested resizable panels for `chat <-> workspace` and `panel A <-> panel B`
   - Mobile: single-column shell with top-level view switching between `Chat`, `A`, `B`, and `Catalog`
2. **Panel-local inspection surfaces**
   - Keep existing tabs: `Preview`, `JSONL`, `Actions`, `Grade`, `Prompt`
   - Evolve `Code` into `TSX`
   - Add `Tree` and `Editor`
3. **Shared reference surface**
   - Add a global catalog drawer/sheet rather than duplicating the same reference UI inside both A/B panels

This is intentionally not a straight copy of `_inspo/json-render`. Kumo's playground already has two simultaneous outputs, chat/tool state, skill injection, and richer diagnostics. The parity work should preserve that strength rather than force everything into a single-artifact UI.

## Scope & Deliverables

| Deliverable                                                         | Effort | Depends On     |
| ------------------------------------------------------------------- | ------ | -------------- |
| D1. Extract playground state + panel model                          | M      | -              |
| D2. Add nested tree inspector + JSON editor tab                     | L      | D1             |
| D3. Add global catalog explorer                                     | M      | D1             |
| D4. Upgrade TSX export actions                                      | S      | D1             |
| D5. Replace fixed layout with desktop resizable + mobile view shell | L      | D1             |
| D6. Integration tests + regression hardening                        | M      | D2, D3, D4, D5 |

## Non-Goals (Explicit Exclusions)

- Version history / iterative snapshots in v1
- Server-side persistence, share URLs, or saved playground sessions
- Feeding manual JSON edits back into chat history or the next model request automatically
- Changes to `/playground/report` behavior beyond compatibility fixes
- Replacing the current tool confirmation flow, skills flow, or eval flow
- Introducing a node-graph or form-based visual tree editor

## Recommendation

Choose a **text-first inspection workflow** over a full visual editor.

- Add a `Tree` tab for a human-readable nested view of the active `UITree`
- Add an `Editor` tab for raw JSON editing with validation + apply/reset controls
- Keep the current A/B comparison model unchanged
- Add a shared catalog drawer instead of per-panel catalog duplication
- Use `react-resizable-panels` for layout because this is a reversible, low-risk dependency that removes a large amount of custom split-pane work

## Data Model

Create a new playground-local state module under `packages/kumo-docs-astro/src/lib/playground/`.

```ts
type PanelId = "a" | "b";

type PanelTab =
  | "preview"
  | "tsx"
  | "jsonl"
  | "tree"
  | "editor"
  | "actions"
  | "grading"
  | "prompt";

type StreamStatus = "idle" | "streaming" | "error";

type EditorStatus = "clean" | "dirty" | "invalid" | "applied";

interface ValidationIssue {
  readonly message: string;
  readonly path: readonly (string | number)[];
}

interface EditorDraft {
  readonly text: string;
  readonly status: EditorStatus;
  readonly source: "stream" | "manual";
  readonly validationIssues: readonly ValidationIssue[];
  readonly lastAppliedAt: string | null;
}

interface NestedTreeNode {
  readonly key: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly action: {
    readonly name: string;
    readonly params?: Record<string, unknown>;
  } | null;
  readonly children: readonly NestedTreeNode[];
}

interface PanelArtifact {
  readonly tree: UITree;
  readonly rawJsonl: string;
  readonly status: StreamStatus;
  readonly activeTab: PanelTab;
  readonly actionLog: readonly ActionLogEntry[];
  readonly editor: EditorDraft;
}

interface PlaygroundLayoutState {
  readonly chatMinimized: boolean;
  readonly catalogOpen: boolean;
  readonly mobileView: "chat" | "a" | "b" | "catalog";
  readonly desktopRootSizes: readonly [number, number];
  readonly workspaceSizes: readonly [number, number];
}
```

Rules:

- `PanelArtifact.editor.text` is always the full serialized tree for that panel.
- `Editor` only mutates the local panel artifact; it does not mutate `messages`, `lastSubmittedRef`, or replay streams.
- `NestedTreeNode` is derived view data only; it is never sent to the API.
- This state model is intentionally compatible with future `RunSnapshot` work, but version history itself is out of scope.

## API / Interface Contract

### Existing server contracts

No API contract changes are required for v1 parity work.

- `/api/chat` remains the source of streamed JSONL patch ops
- `/api/chat/prompt` remains the source of rendered system prompt text
- `/api/chat/skills` remains the source of skill metadata

### New client-side contracts

1. **Playground state module**
   - Add `src/lib/playground/state.ts`
   - Export reducer/actions or equivalent pure state helpers for panel updates, editor updates, layout updates, and reset/apply flows

2. **Nested tree transform**
   - Add `src/lib/playground/nested-tree.ts`
   - `buildNestedTree(tree: UITree): NestedTreeNode | null`
   - Preserve stable `key`, `type`, `props`, `action`, and recursively inlined children

3. **Editable tree validation**
   - Add `src/lib/playground/validate-tree.ts`
   - Parse JSON text at the boundary and validate before apply
   - Validation uses Kumo catalog validation rather than unchecked casts
   - Contract:

```ts
function validateEditableTree(
  text: string,
):
  | { readonly success: true; readonly tree: UITree }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] };
```

4. **Catalog explorer data**
   - Add `src/lib/playground/catalog-data.ts`
   - Component metadata source: `virtual:kumo-registry`
   - Action metadata source: explicit display map built from `BUILTIN_HANDLERS` semantics plus local playground actions (`tool_approve`, `tool_cancel`)
   - Contract:

```ts
interface CatalogComponentEntry {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly importPath: string;
  readonly props: readonly {
    readonly name: string;
    readonly type: string;
    readonly required: boolean;
  }[];
}

interface CatalogActionEntry {
  readonly name: string;
  readonly description: string;
  readonly params: readonly { readonly name: string; readonly type: string }[];
}
```

5. **TSX export controls**
   - Keep `uiTreeToJsx()` as the source of generated TSX
   - Extend tab UI with:
     - `Copy`
     - `Download .tsx`
     - panel-specific component name default (`GeneratedPanelA`, `GeneratedPanelB`)

## Detailed Design

### D1. Extract playground state + panel model

Likely files:

- `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`
- `packages/kumo-docs-astro/src/lib/playground/state.ts`
- `packages/kumo-docs-astro/src/lib/playground/types.ts`

Changes:

- Move state shapes and pure transitions out of `_PlaygroundPage.tsx`
- Replace mirrored `foo` / `noPromptFoo` local state with `panelA` / `panelB` artifact updates
- Keep current streaming behavior and abort semantics unchanged
- Preserve current chat/tool/skills flows while reducing local coupling

Acceptance:

- Existing A/B generation still works with no behavior regression
- Existing tabs still behave the same before new features are added
- Panel-local state updates are testable without rendering the full page

### D2. Add `Tree` + `Editor` tabs

Likely files:

- `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`
- `packages/kumo-docs-astro/src/lib/playground/nested-tree.ts`
- `packages/kumo-docs-astro/src/lib/playground/validate-tree.ts`

#### Tree tab

Render a readable nested representation of the active panel tree.

Requirements:

- show `key`, `type`, `props`, `action`, and nested `children`
- update live while a stream is active
- support copy-to-clipboard
- render empty state when no tree exists

#### Editor tab

Render the full active panel `UITree` JSON in a monospace editing surface.

Controls:

- `Format`
- `Validate`
- `Apply`
- `Reset to latest streamed tree`

Behavior:

- editing marks the draft `dirty`
- invalid JSON or invalid tree shape sets `invalid` and surfaces field paths
- `Apply` replaces only the active panel's rendered tree + derived TSX/tree/grading views
- `Apply` does not mutate chat history, last submitted prompt, or trigger a new model request
- `Reset` restores the last streamed tree for that panel

Acceptance:

- Tree tab reflects streamed updates without page reload
- Editor tab blocks apply on invalid JSON or invalid `UITree`
- Applying valid JSON updates preview, TSX, grading, and actions-derived views for that panel only
- Panel B skill/apply flow still works after a manual local edit on either panel

### D3. Add global catalog explorer

Likely files:

- `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`
- `packages/kumo-docs-astro/src/lib/playground/catalog-data.ts`
- `packages/kumo-docs-astro/src/components/demos/RegistryDemo.tsx` (reuse patterns, not direct embedding)

Design:

- Desktop: catalog opens in a shared drawer from the workspace header
- Mobile: catalog is a first-class top-level mobile view
- Content sections:
  - `Components`
  - `Actions`

Requirements:

- searchable by component/action name
- filterable by component category
- show prop names/types/requiredness for components
- show short action descriptions and params for built-in + playground-specific actions
- provide doc link or import hint where applicable

Acceptance:

- User can inspect component metadata without leaving `/playground`
- User can inspect built-in action names (`increment`, `decrement`, `reset`, `set`, `toggle`, `submit_form`, `navigate`) and playground actions (`tool_approve`, `tool_cancel`)
- Catalog explorer does not break existing layout at desktop or mobile widths

### D4. Upgrade TSX export actions

Likely files:

- `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`

Changes:

- Rename tab label from `Code` to `TSX`
- Keep `uiTreeToJsx()` output as the generated source
- Add panel-aware `Copy` and `Download .tsx`
- Default component names:
  - Panel A: `GeneratedPanelA`
  - Panel B: `GeneratedPanelB`

Acceptance:

- TSX tab still updates live from the active panel tree
- Copy button writes a complete importable TSX module
- Download button saves a `.tsx` file with the expected panel-specific component name
- Custom component handling remains explicit; if output contains `DemoButton`, the export UI warns that local demo components are playground-only

### D5. Replace fixed layout with resizable desktop + mobile shell

Likely files:

- `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`
- new small wrapper around `react-resizable-panels` in docs package

Decision:

- Add `react-resizable-panels` and wrap it in a docs-local adapter component
- Persist panel sizes in `localStorage`

Desktop behavior:

- root split: `chat | workspace`
- nested workspace split: `panel A | panel B`
- retain current chat minimize affordance

Mobile behavior:

- top segmented control switches between `Chat`, `A`, `B`, `Catalog`
- each panel keeps its own tabs inside the mobile panel view
- no duplicated chat + panel rendering trees in parallel branches

Acceptance:

- Desktop users can resize chat width and A/B panel split
- Layout sizes persist across refresh in the same browser
- Mobile users can access chat, both panels, and catalog without losing state
- `/playground` remains a single route and `report.astro` remains reachable at `/playground/report`

### D6. Integration tests + regression hardening

Likely files:

- playground state tests
- nested tree transform tests
- validation tests
- React integration tests for editor/apply/layout flows

Acceptance:

- state reducer/helpers cover editor apply/reset and layout persistence
- nested tree transform is deterministic for a representative `UITree`
- validation helper returns structured issues for malformed JSON and invalid trees
- integration test covers: stream -> edit JSON -> apply -> preview/TSX/grading update

## Test Strategy

| Layer       | What                         | How                                                                                             |
| ----------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Unit        | `buildNestedTree`            | Vitest fixtures using representative `UITree` samples                                           |
| Unit        | `validateEditableTree`       | Valid tree, malformed JSON, missing root, missing elements, bad child references                |
| Unit        | playground state transitions | Pure reducer/helper tests for tab switch, editor dirty/apply/reset, layout persistence payloads |
| Integration | `Editor` apply flow          | React Testing Library: edit JSON, validate, apply, assert preview/TSX/grading updates           |
| Integration | catalog explorer             | Render catalog drawer, search/filter, assert component/action metadata                          |
| Integration | layout shell                 | Assert desktop resize persistence and mobile top-level view switching                           |
| Manual      | regression sweep             | A/B streaming, tool confirmation cards, skill apply, prompt tab, report route                   |

## Risks & Mitigations

| Risk                                                                   | Likelihood | Impact | Mitigation                                                                                                                  |
| ---------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `_PlaygroundPage.tsx` grows into an unmaintainable god-component again | High       | High   | Extract state/helpers first; keep new logic in `src/lib/playground/*` and split presentational subcomponents                |
| Manual JSON editing introduces invalid trees or crashes renderers      | High       | High   | Validate before apply; never use unchecked casts at the editor boundary; preserve last valid tree                           |
| Tab sprawl hurts usability                                             | Medium     | Medium | Keep catalog global, not per-panel; rename `Code` to `TSX`; group panel tabs consistently                                   |
| Mobile implementation duplicates large sections of desktop UI          | Medium     | High   | Use a single state model and view-switch shell instead of separate mobile/desktop render trees                              |
| New resizable dependency adds unwanted complexity                      | Low        | Medium | Isolate via small adapter; if rejected later, root and workspace splitters can be replaced without touching panel internals |
| TSX export misleads users when custom demo components appear           | Medium     | Medium | Warn explicitly in export UI when playground-only components are present                                                    |

## Trade-offs Made

| Chose                                 | Over                                                | Because                                                                                   |
| ------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| No version history in v1              | Full json-render-style snapshot stack               | User explicitly deprioritized it; it would complicate state and stream lifecycle the most |
| Text JSON editor                      | Third-party visual JSON editor                      | Matches requested scope, avoids a heavy dependency, and keeps validation explicit         |
| Global catalog drawer                 | Duplicated per-panel catalog tab                    | Same reference data does not benefit from A/B duplication and would overcrowd panel tabs  |
| Reducer/state module extraction first | Adding features directly into `_PlaygroundPage.tsx` | Lowers regression risk and creates a clean base for future snapshot work                  |
| `react-resizable-panels`              | Hand-rolled drag splitters                          | Faster path to a reliable UX; reversible dependency decision                              |

## Acceptance Criteria

- [ ] `/playground` stays the primary route; `/playground/report` remains intact.
- [ ] All implementation for this spec lands on `geoquant/streaming-ui`.
- [ ] Panel tabs become: `Preview`, `TSX`, `JSONL`, `Tree`, `Editor`, `Actions`, `Grade`, `Prompt`.
- [ ] `Tree` shows a readable nested representation of the current panel tree and updates live during streaming.
- [ ] `Editor` allows local JSON editing with `Format`, `Validate`, `Apply`, and `Reset to latest streamed tree`.
- [ ] Invalid JSON or invalid tree data never replaces the last valid rendered tree.
- [ ] Applying a valid JSON edit updates only the active panel's local artifact and derived views; it does not mutate chat history or trigger a new request.
- [ ] A shared catalog explorer is available from desktop and mobile and exposes both components and actions.
- [ ] `TSX` tab supports copy + download of a full `.tsx` module.
- [ ] Desktop supports resizing `chat <-> workspace` and `panel A <-> panel B` with persisted sizes.
- [ ] Mobile exposes `Chat`, `A`, `B`, and `Catalog` views without losing current panel/chat state.
- [ ] Existing features still work: A/B streaming, skill injection on panel B, tool confirmation cards, prompt inspection, grading, action log, eval report route.

## Success Metrics

- A user can inspect structure, edit the active tree, export TSX, and look up component/action metadata without leaving `/playground`.
- The number of context switches needed to debug a near-miss generation drops from “leave playground / inspect code elsewhere” to in-page workflows only.
- No regression bugs are introduced in the existing A/B, skills, tool, or eval flows.

## Handoff Summary

1. **D1. Extract playground state + panel model** (M)
   - Depends on: -
   - Files likely touched: `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`, `packages/kumo-docs-astro/src/lib/playground/types.ts`, `packages/kumo-docs-astro/src/lib/playground/state.ts`

2. **D2. Add `Tree` + `Editor` tabs** (L)
   - Depends on: D1
   - Files likely touched: `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`, `packages/kumo-docs-astro/src/lib/playground/nested-tree.ts`, `packages/kumo-docs-astro/src/lib/playground/validate-tree.ts`

3. **D3. Add global catalog explorer** (M)
   - Depends on: D1
   - Files likely touched: `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`, `packages/kumo-docs-astro/src/lib/playground/catalog-data.ts`

4. **D4. Upgrade TSX export actions** (S)
   - Depends on: D1
   - Files likely touched: `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`

5. **D5. Replace fixed layout with desktop resizable + mobile shell** (L)
   - Depends on: D1
   - Files likely touched: `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`, new docs-local resizable wrapper component

6. **D6. Integration tests + regression hardening** (M)
   - Depends on: D2, D3, D4, D5
   - Files likely touched: playground lib/component tests under `packages/kumo-docs-astro`

## Open Questions

- [ ] None. Version history is explicitly deferred from this spec. → Owner: n/a
