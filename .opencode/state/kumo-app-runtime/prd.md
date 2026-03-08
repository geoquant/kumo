# Kumo App Runtime

**Type:** RFC + Implementation Plan
**Effort:** XL (>2 days)
**Branch:** `geoquant/streaming-ui` (CRITICAL: all work stays here)
**Status:** Ready for implementation
**Updated:** 2026-03-07

## Summary

Kumo should evolve from a strong streamed UI tree renderer into a first-class app runtime for Kumo-based generative apps.

This spec adds five missing pillars in one implementation phase:

1. spec-level app state + bindings
2. event maps + chained built-in actions
3. repeat/list semantics
4. validation + watchers
5. packaged `useUIStream` + `useChatUI`

The result must be strong enough to ship a task CRUD + forms example in Astro docs without hand-rolled runtime orchestration.

## Problem Statement

**Who:** Kumo team building and evaluating app-like generative UI inside docs and future product surfaces.

**What:** Current Kumo runtime can stream and render flat UI trees, but it cannot model app state, reactive bindings, repeatable collections, chained event logic, or reusable chat/runtime hooks well enough to build serious app flows.

**Why it matters:** Without these primitives, every app-like demo reimplements runtime behavior in app code, the prompt contract stays narrower than the product ambition, and Kumo cannot credibly compete as a generative app platform.

**Evidence:**

- `packages/kumo/src/streaming/runtime-value-store.ts` only captures transient per-element values.
- `packages/kumo/src/catalog/types.ts` and `packages/kumo/src/catalog/data.ts` support only literals plus simple path refs.
- `packages/kumo/src/catalog/types.ts` models one top-level action per element.
- `packages/kumo/src/streaming/rfc6902.ts` only supports `add`, `replace`, `remove`.
- `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx` hand-rolls chat history, stream parsing, patch application, action bridging, and dual-session orchestration.

## Constraints

- Keep all work on `geoquant/streaming-ui`.
- This is a hard rule for every task, subtask, and follow-on change in this spec.
- Do not introduce external runtime dependencies.
- Optimize for a working Astro docs example first.
- Core semantics and React/web bindings must be split, but do not create a new workspace package in v1.
- Existing streaming demos may change; this is experimental. Still provide a small legacy adapter to reduce churn.
- Use JSON Pointer as the single path language across bindings, actions, repeat, validation, watchers, and patches.
- Stay React/web-only in v1.

## Discovery

### Current architecture

- `packages/kumo/src/catalog/` is the contract/prompt layer.
- `packages/kumo/src/streaming/` owns patch application, action dispatch, and transient value capture.
- `packages/kumo/src/generative/ui-tree-renderer.tsx` owns normalize/repair/render.
- Runtime rendering is mostly separate from catalog prompt generation.
- The docs playground already contains the shape of `useUIStream` and `useChatUI`, but buried in app code.

### Sharp findings

- Kumo has typed dynamic values, but renderer/action runtime does not fully evaluate them.
- Tree state, wrapper-local state, and runtime input state are separate sources of truth today.
- The flat keyed tree is still the right base model for streaming and repair; replacing it would create avoidable rewrite risk.
- The biggest leverage point is a shared runtime core that all of props, visibility, events, repeat, validation, watchers, and hooks use.

## Recommendation

Build a new app runtime inside `packages/kumo` with two layers:

1. `src/app-runtime/core/` — pure TypeScript semantics for spec shape, expressions, state store, actions, repeat, validation, watchers, and spec normalization.
2. `src/app-runtime/react/` — React/web adapters for rendering, action dispatch, and packaged hooks.

Keep the flat keyed tree. Expand the top-level streamed document from `UITree` into a richer `AppSpec`. Local user actions mutate state through the runtime store. Remote streamed patches mutate the whole spec document through full RFC 6902 ops. The renderer always consumes a resolved render snapshot derived from `AppSpec + store + repeat scopes + validation meta`.

This is the balanced option: cleaner than a docs-only extraction, lower risk than a state-first rewrite, and aligned with future non-React expansion if Kumo wants it later.

## Detailed Design

### 1. Runtime boundaries

#### Core: `packages/kumo/src/app-runtime/core/`

Responsibilities:

- spec types
- expression resolution
- immutable store updates
- action execution planning
- repeat expansion
- validation engine
- watcher evaluation
- spec normalization + repair helpers
- full RFC 6902 patch application for the app spec document

Core must have no React imports.

#### React adapter: `packages/kumo/src/app-runtime/react/`

Responsibilities:

- runtime providers/contexts
- renderer integration with Kumo components
- event wiring from rendered components to action execution
- `useUIStream`
- `useChatUI`
- mixed text + UI stream helpers

#### Existing folders after migration

- `catalog/` stays prompt/schema/validation-contract oriented.
- `streaming/` becomes transport/parsing glue and may re-export React hooks.
- `generative/` keeps renderer-specific code, but uses app runtime services instead of owning state logic.

### 2. New top-level document: `AppSpec`

`UITree` is replaced as the primary runtime document by `AppSpec`.

```ts
type JsonPointer = `/${string}` | "/";

interface AppSpec {
  version: "app/v1";
  root: string;
  elements: Record<string, AppElement>;
  state: Record<string, unknown>;
  meta?: AppSpecMeta;
}

interface AppSpecMeta {
  title?: string;
  description?: string;
}

interface AppElement {
  key: string;
  type: string;
  props?: Record<string, ValueExpr>;
  children?: string[];
  visible?: BoolExpr;
  events?: Partial<Record<KumoEventName, ActionSequence>>;
  repeat?: RepeatSpec;
  watch?: WatchRule[];
  validation?: FieldValidationSpec;
}

type KumoEventName = "press" | "change" | "submit" | "blur" | "focus" | "mount";

type ActionSequence = ActionStep | ActionStep[];
```

Notes:

- `state` is required, even if empty.
- `events` replaces singular `action`.
- `repeat`, `watch`, and `validation` are first-class element fields.
- `AppSpec` remains flat and keyed for streaming friendliness.

### 3. Expression system

Kumo gets one small expression language reused across props, visibility, action params, validation args, and watcher guards.

#### Design goals

- one syntax across all subsystems
- JSON-serializable
- explicit scope source
- safe to evaluate during render and action planning
- Kumo-native names, not borrowed operator names

#### Value expressions

```ts
type ValueExpr =
  | string
  | number
  | boolean
  | null
  | ValueExpr[]
  | { [key: string]: ValueExpr }
  | ReadExpr
  | BindExpr
  | SwitchExpr
  | FormatExpr
  | ComputeExpr;

interface ReadExpr {
  $read: RefSource;
}

interface BindExpr {
  $bind: RefSource;
}

interface SwitchExpr {
  $switch: {
    when: BoolExpr;
    then: ValueExpr;
    else?: ValueExpr;
  };
}

interface FormatExpr {
  $format: Array<string | ValueExpr>;
}

interface ComputeExpr {
  $compute: {
    fn: string;
    args?: ValueExpr[];
  };
}

type RefSource =
  | { source: "state"; path: JsonPointer }
  | { source: "item"; path?: JsonPointer }
  | { source: "index" }
  | { source: "meta"; path: JsonPointer };
```

#### Boolean expressions

```ts
type BoolExpr =
  | boolean
  | { $not: BoolExpr }
  | {
      $compare: {
        left: ValueExpr;
        op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";
        right: ValueExpr;
      };
    }
  | { $and: BoolExpr[] }
  | { $or: BoolExpr[] };
```

Rules:

- Expressions resolve recursively through arrays and objects.
- `$bind` is illegal in `visible`; parser rejects it.
- Action params keep unresolved binding metadata until action execution planning.
- `source: "item"` and `source: "index"` are only legal inside a resolved repeat scope.

### 4. State store

Create a single app store for runtime state and runtime metadata.

```ts
interface AppStoreSnapshot {
  state: Record<string, unknown>;
  meta: RuntimeMeta;
}

interface RuntimeMeta {
  validation: Record<string, FieldValidationState>;
  stream: {
    status: "idle" | "streaming" | "complete" | "error";
    lastError?: string;
  };
}

interface AppStore {
  getSnapshot(): AppStoreSnapshot;
  getValue(path: JsonPointer): unknown;
  setValue(path: JsonPointer, value: unknown): void;
  applyPatches(patches: JsonPatchOp[]): void;
  subscribe(listener: () => void): () => void;
}
```

Rules:

- `state` holds user-authored app data.
- `meta` holds runtime-owned data only.
- validation errors live in `meta.validation`, not mixed into app state unless an action explicitly writes them.
- the store is immutable at the snapshot boundary.

`runtime-value-store.ts` is retired after migration. Input capture writes directly through `AppStore` using resolved bindings.

### 5. Events and actions

Every element can declare multiple events, each with one or many action steps.

```ts
interface ActionStep {
  action: BuiltInActionName | string;
  params?: Record<string, ValueExpr>;
  when?: BoolExpr;
  confirm?: ConfirmSpec;
  onSuccess?: ActionSequence;
  onError?: ActionSequence;
}

interface ConfirmSpec {
  title: ValueExpr;
  description?: ValueExpr;
  confirmLabel?: ValueExpr;
  cancelLabel?: ValueExpr;
}

type BuiltInActionName =
  | "state.set"
  | "state.merge"
  | "state.toggle"
  | "state.increment"
  | "state.decrement"
  | "state.reset"
  | "list.append"
  | "list.insert"
  | "list.remove"
  | "list.replace"
  | "list.move"
  | "form.validate"
  | "form.clear"
  | "form.submit"
  | "nav.navigate";
```

Execution rules:

- event handlers execute action steps sequentially.
- each step sees the latest store snapshot.
- `when` is evaluated immediately before the step.
- `onSuccess` and `onError` run as nested sequences.
- host effects still flow through `processActionResult`, but now as typed runtime effects instead of ad hoc branching.

`submit_form` is removed. Form submission becomes `submit` event + action sequence.

### 6. Repeat/list semantics

Repeat is declared on the container element that owns repeated children.

```ts
interface RepeatSpec {
  source: { source: "state"; path: JsonPointer };
  as?: string;
  indexAs?: string;
  keyBy?: JsonPointer;
}

interface RepeatScope {
  item: unknown;
  index: number;
  itemPath: JsonPointer;
}
```

Rules:

- `repeat.source` must resolve to an array.
- repeated children are expanded at render time into a derived snapshot; the base spec stays flat.
- bindings inside a repeat can target item-relative paths.
- `keyBy` uses an item-relative pointer; fallback is the concrete item path.
- repeat scopes are available to props, visibility, action params, validation, and watchers.

### 7. Validation model

Validation is built into the runtime and works for field-level and form-level flows.

```ts
interface FieldValidationSpec {
  path: JsonPointer;
  mode?: Array<"change" | "blur" | "submit">;
  rules: ValidationRule[];
}

type ValidationRule =
  | { type: "required"; message: ValueExpr }
  | { type: "minLength"; value: number; message: ValueExpr }
  | { type: "maxLength"; value: number; message: ValueExpr }
  | { type: "email"; message: ValueExpr }
  | { type: "url"; message: ValueExpr }
  | { type: "number"; message: ValueExpr }
  | { type: "min"; value: number; message: ValueExpr }
  | { type: "max"; value: number; message: ValueExpr }
  | { type: "matches"; other: ValueExpr; message: ValueExpr }
  | { type: "custom"; fn: string; args?: ValueExpr[]; message: ValueExpr };

interface FieldValidationState {
  valid: boolean;
  touched: boolean;
  dirty: boolean;
  errors: string[];
}
```

Rules:

- validation rules use the same expression resolver as props/actions.
- input components with `$bind` automatically receive validation state when a matching `validation.path` exists.
- `form.validate` validates all descendant fields under the submitting form element and returns a typed result.
- forms can block `form.submit` if validation fails.

### 8. Watchers

Watchers are declarative reactions to state changes.

```ts
interface WatchRule {
  path: JsonPointer;
  when?: BoolExpr;
  debounceMs?: number;
  actions: ActionSequence;
}
```

Rules:

- watchers trigger only after a real value change.
- watchers do not run on initial mount.
- watcher evaluation happens after each successful action step and after remote patch application.
- runtime must guard against infinite loops with a max reaction depth of 10 and a cycle error in dev.

Use watchers for derived side effects, not for basic derived display values. Derived display should prefer expressions.

### 9. Full patch support

Upgrade `packages/kumo/src/streaming/rfc6902.ts` to support all RFC 6902 ops:

- `add`
- `remove`
- `replace`
- `move`
- `copy`
- `test`

Rules:

- patches target the full `AppSpec` document, including `/elements/*` and `/state/*`.
- array inserts by numeric index must work.
- `test` must enforce equality in core patch application.
- React streaming helpers may ignore `test` for render-side no-op optimization, but core patch semantics remain strict.

### 10. Spec normalization + repair

Add pure helpers in core:

- `normalizeAppSpec(input): AppSpec`
- `flattenNestedSpec(input): AppSpec`
- `repairAppSpec(spec, registry): RepairResult`

Responsibilities:

- accept either nested authoring input or flat runtime input
- generate stable keys where missing
- coerce one-child shorthands into arrays
- reject illegal expression placement
- repair obvious structural issues before render

This replaces renderer-only repair as the primary normalization boundary.

### 11. Packaged hooks

#### `useUIStream`

Location: `packages/kumo/src/app-runtime/react/use-ui-stream.ts`

```ts
interface UseUIStreamOptions<TRequest> {
  initialSpec?: AppSpec;
  request: (input: TRequest, signal: AbortSignal) => Promise<Response>;
  onActionEffect?: (effect: RuntimeEffect) => Promise<void> | void;
}

interface UIStreamSession<TRequest> {
  spec: AppSpec;
  store: AppStore;
  rawLines: string[];
  status: "idle" | "streaming" | "complete" | "error";
  error?: string;
  send(input: TRequest): Promise<void>;
  cancel(): void;
  reset(nextSpec?: AppSpec): void;
}
```

Responsibilities:

- read SSE/JSONL
- parse mixed stream parts
- apply spec patches
- update store meta
- expose cancel/reset/status
- bridge local action effects to host callbacks

#### `useChatUI`

Location: `packages/kumo/src/app-runtime/react/use-chat-ui.ts`

```ts
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: ChatPart[];
}

type ChatPart =
  | { type: "text"; text: string }
  | { type: "ui"; spec: AppSpec }
  | { type: "ui-patch"; patches: JsonPatchOp[] }
  | { type: "tool"; name: string; state: string; payload?: unknown };

interface UseChatUIOptions<TSend> {
  initialMessages?: ChatMessage[];
  stream: UIStreamSession<TSend>;
  serializeHistory?: (messages: ChatMessage[]) => unknown;
}
```

Responsibilities:

- manage message history
- accumulate assistant text and UI parts in one turn
- serialize history for follow-up requests
- include current spec on follow-ups when configured
- support message interceptors for app-specific tool flows

### 12. Proving-ground example

Ship one docs example proving the runtime:

`Task CRUD + forms`

Capabilities required in the example:

- list existing tasks from `state`
- add task via bound input + submit
- edit task inline via repeat-scoped bindings
- delete task via chained actions
- validate title required + minimum length
- show derived task counts
- drive the example through streamed UI updates and follow-up chat prompts

This example is the acceptance harness for the whole phase.

## Scope & Deliverables

| Deliverable                                            | Effort | Depends On |
| ------------------------------------------------------ | ------ | ---------- |
| D1. App runtime core scaffold                          | M      | -          |
| D2. Expression resolver + store + action engine        | L      | D1         |
| D3. Repeat + validation + watchers                     | L      | D2         |
| D4. Full patch engine + normalization/repair helpers   | M      | D1         |
| D5. React adapter + `useUIStream` + `useChatUI`        | L      | D2, D3, D4 |
| D6. Renderer/action migration + docs Task CRUD example | L      | D5         |

### D1. App runtime core scaffold

Critical branch rule: implement this deliverable only on `geoquant/streaming-ui`.

Files:

- `packages/kumo/src/app-runtime/core/types.ts`
- `packages/kumo/src/app-runtime/core/index.ts`
- `packages/kumo/src/index.ts`
- `packages/kumo/package.json`
- `packages/kumo/vite.config.ts`

Acceptance:

- all work for this deliverable stays on `geoquant/streaming-ui`.
- `AppSpec`, `AppElement`, expression, action, repeat, validation, watcher, and store types are defined and exported.
- legacy `UITree` types are kept only as compatibility aliases or removed behind a migration adapter.

### D2. Expression resolver + store + action engine

Critical branch rule: implement this deliverable only on `geoquant/streaming-ui`.

Files:

- `packages/kumo/src/app-runtime/core/expressions.ts`
- `packages/kumo/src/app-runtime/core/store.ts`
- `packages/kumo/src/app-runtime/core/actions.ts`
- `packages/kumo/src/streaming/action-handler.ts`
- `packages/kumo/src/streaming/action-registry.ts`
- `packages/kumo/src/streaming/process-action-result.ts`
- `packages/kumo/src/streaming/runtime-value-store.ts` (delete or replace)

Acceptance:

- all work for this deliverable stays on `geoquant/streaming-ui`.
- props, visibility, action params, and confirm text resolve against shared runtime context.
- `$bind` writes through the store.
- event maps execute chained actions sequentially.
- built-in state/list/form actions work against the app store.

### D3. Repeat + validation + watchers

Critical branch rule: implement this deliverable only on `geoquant/streaming-ui`.

Files:

- `packages/kumo/src/app-runtime/core/repeat.ts`
- `packages/kumo/src/app-runtime/core/validation.ts`
- `packages/kumo/src/app-runtime/core/watchers.ts`
- `packages/kumo/src/generative/ui-tree-renderer.tsx`
- `packages/kumo/src/generative/stateful-wrappers.tsx`

Acceptance:

- all work for this deliverable stays on `geoquant/streaming-ui`.
- repeated children render from array state.
- repeat-scoped bindings can read and write item fields.
- field validation runs on declared modes.
- watcher-triggered actions run after state changes and stop on cycle protection.

### D4. Full patch engine + normalization/repair helpers

Critical branch rule: implement this deliverable only on `geoquant/streaming-ui`.

Files:

- `packages/kumo/src/streaming/rfc6902.ts`
- `packages/kumo/src/app-runtime/core/normalize.ts`
- `packages/kumo/src/app-runtime/core/repair.ts`
- `packages/kumo/src/catalog/catalog.ts`
- `packages/kumo/src/catalog/types.ts`

Acceptance:

- all work for this deliverable stays on `geoquant/streaming-ui`.
- all six RFC 6902 ops are supported in core tests.
- nested authoring input can be flattened into runtime shape.
- repair happens before render, not only inside renderer.

### D5. React adapter + `useUIStream` + `useChatUI`

Critical branch rule: implement this deliverable only on `geoquant/streaming-ui`.

Files:

- `packages/kumo/src/app-runtime/react/runtime-context.tsx`
- `packages/kumo/src/app-runtime/react/use-ui-stream.ts`
- `packages/kumo/src/app-runtime/react/use-chat-ui.ts`
- `packages/kumo/src/app-runtime/react/index.ts`
- `packages/kumo/src/streaming/hooks.ts`
- `packages/kumo/src/generative/ui-tree-renderer.tsx`

Acceptance:

- all work for this deliverable stays on `geoquant/streaming-ui`.
- one hook instance can drive one streamed app session end to end.
- mixed text + UI stream parts accumulate correctly.
- apps can intercept runtime effects without forking hook internals.

### D6. Renderer/action migration + docs Task CRUD example

Critical branch rule: implement this deliverable only on `geoquant/streaming-ui`.

Files:

- `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`
- `packages/kumo-docs-astro/src/components/demos/_StreamingDemo.tsx`
- `packages/kumo-docs-astro/src/components/demos/` (new Task CRUD demo)
- `packages/kumo-docs-astro/src/lib/read-sse-stream.ts`
- `packages/kumo-docs-astro/src/pages/api/chat/index.ts`

Acceptance:

- all work for this deliverable stays on `geoquant/streaming-ui`.
- playground stream orchestration moves to packaged hooks.
- docs ship a working task CRUD + forms example using `AppSpec` features.
- no demo keeps a duplicated hand-rolled stream loop unless it is intentionally app-specific.

## Migration / Rollout

This is one implementation phase, but still ordered risk-first.

1. land pure core types + resolver/store/action engine
2. land repeat/validation/watchers and full patch support
3. switch renderer to resolved runtime snapshots
4. package hooks
5. migrate playground and add Task CRUD demo
6. delete obsolete transient runtime store paths

Compatibility plan:

- keep implementation on `geoquant/streaming-ui` for the full migration; do not branch this work elsewhere.
- add `liftLegacyTree(tree: UITree): AppSpec` during migration
- keep current docs demos working through the adapter until migrated
- remove legacy adapter only after docs runtime and tests are green

## Non-Goals

- Vue, Svelte, React Native, PDF, email, image, or video renderers
- external store adapters in v1
- full navigation stack state machine
- arbitrary user-defined effect plugins beyond current host action extension points
- generated prompt changes beyond what is required to describe new spec fields

## API / Interface Contract

### Prompt/catalog contract

- catalog prompt generation must describe `state`, `events`, `repeat`, `validation`, and `watch`.
- component registry metadata must declare supported Kumo event names per component where needed.
- validation must reject illegal field combinations before render.

### Renderer contract

- renderer accepts `AppSpec` + store context, not a bare `UITree`.
- renderer resolves props/visibility against the current runtime context.
- renderer injects bound `value`, `checked`, `selected`, and event handlers for components with `$bind`.

### Stream transport contract

SSE/JSONL payloads may include:

```ts
type RuntimeStreamPart =
  | { type: "text-delta"; text: string }
  | { type: "ui-patch"; patches: JsonPatchOp[] }
  | { type: "ui-spec"; spec: AppSpec }
  | { type: "usage"; inputTokens?: number; outputTokens?: number }
  | { type: "error"; message: string }
  | { type: "done" };
```

`useUIStream` must handle both patch-based and full-spec replacement flows.

## Test Strategy

| Layer       | What                  | How                                                                  |
| ----------- | --------------------- | -------------------------------------------------------------------- |
| Unit        | expression resolution | Vitest table tests across state/item/index/meta scopes               |
| Unit        | store updates         | immutable path update tests + watcher trigger tests                  |
| Unit        | action engine         | chained action tests with success/error branches                     |
| Unit        | repeat                | render-snapshot expansion tests with key stability assertions        |
| Unit        | validation            | per-rule and form-level tests                                        |
| Unit        | RFC 6902              | compliance tests for add/remove/replace/move/copy/test               |
| Integration | renderer bindings     | React tests with bound inputs, visibility, repeat, validation errors |
| Integration | hooks                 | mock SSE stream tests for mixed text + UI parts                      |
| Integration | docs demo             | smoke test for Task CRUD happy path                                  |

## Acceptance Criteria

- [ ] `AppSpec` supports top-level `state`, per-element `events`, `repeat`, `validation`, and `watch`.
- [ ] One expression system powers props, visibility, action params, validation args, and watcher guards.
- [ ] Bound inputs no longer rely on `runtime-value-store`; they read/write through the app store.
- [ ] Chained built-in actions can mutate scalar state and list state in one event flow.
- [ ] Repeat-scoped reads and writes work for task CRUD style lists.
- [ ] Validation can block submit and expose field errors to rendered controls.
- [ ] Watchers run on real state changes and are cycle-protected.
- [ ] Patch engine supports all six RFC 6902 ops.
- [ ] `useUIStream` packages stream parsing, patch application, cancel/reset, and status handling.
- [ ] `useChatUI` packages mixed text + UI message accumulation and follow-up history serialization.
- [ ] `_PlaygroundPage.tsx` stops hand-rolling the core chat/runtime loop.
- [ ] Astro docs include a working task CRUD + forms example driven by the new runtime.

## Risks & Mitigations

| Risk                                                     | Likelihood | Impact | Mitigation                                                                 |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Scope too large for one phase                            | High       | High   | Keep platform breadth, nav stack, and external adapters out of scope       |
| Too much logic remains inside renderer                   | Medium     | High   | Move normalize/resolve/repair into pure core modules before hook migration |
| Binding + watcher loops create render storms             | Medium     | High   | enforce reaction depth cap, strict dev errors, unit coverage for cycles    |
| Legacy demos break during migration                      | Medium     | Medium | keep `liftLegacyTree()` adapter until docs consumers migrate               |
| Over-designed expression language becomes hard to prompt | Medium     | Medium | keep operator set minimal; no arbitrary inline JS                          |
| Store/meta split leaks into app authorship               | Low        | Medium | hide meta behind runtime helpers and only expose it via read expressions   |

## Trade-offs Made

| Chose                                              | Over                               | Because                                                                    |
| -------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| Flat keyed `AppSpec`                               | nested live runtime tree           | streaming patches and repair already fit flat keyed graphs                 |
| New `app-runtime/` layer inside `packages/kumo`    | new workspace package now          | faster delivery, less package churn, still preserves core/react separation |
| Kumo-native expression operators                   | reusing current path-only refs     | one unified DSL is required for stateful apps                              |
| One implementation phase with ordered deliverables | separate phase 1 / phase 2 rollout | user wants one landing zone; ordered slices still manage risk              |
| Legacy adapter during migration                    | hard break to new spec immediately | lowers docs churn while experimental APIs settle                           |

## Success Metrics

- Docs playground code deletes its duplicated core stream/runtime loop.
- Task CRUD + forms demo works without app-local runtime primitives.
- At least one follow-up chat turn updates both UI structure and app state correctly.
- Runtime unit/integration coverage exists for expressions, actions, repeat, validation, watchers, and patch ops.
- New prompt contract can describe a stateful task CRUD app without manual post-processing.

## Open Questions

- None.

## Handoff

**Status:** Ready for task breakdown

Ordered deliverables:

1. **D1** (M) — add `AppSpec` core types and exports
2. **D2** (L) — add shared resolver/store/action engine
3. **D3** (L) — add repeat, validation, watchers
4. **D4** (M) — add full patch support + normalization helpers
5. **D5** (L) — package React runtime hooks
6. **D6** (L) — migrate playground + ship Task CRUD example

Critical branch rule for every item above: stay on `geoquant/streaming-ui`.

Spec written to: `specs/kumo-app-runtime.md`
