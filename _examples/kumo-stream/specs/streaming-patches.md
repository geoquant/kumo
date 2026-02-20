# Spec: Real Streaming via JSONL Patches

**Type:** Feature Plan
**Effort:** L (1–2 days)
**Status:** Implemented on `geoquant/streaming-ui`
**Branch:** `geoquant/streaming-ui` (only)

## Problem

kumo-stream renders UI atomically: spinner → entire UI snaps in. The LLM outputs a monolithic UITree JSON blob. `extractUITree()` returns null on every token until the final `}`, then `setTree(parsed)` renders everything at once.

The patch system (`patches.ts`, `useUITree` hook, 519-line test suite) exists but is completely bypassed by `ChatDemo.tsx`.

## Goal

Components stream in progressively — root Surface first, then children one-by-one — like json-render demonstrates but using Kumo's own infrastructure.

## Constraints

- Work only on `geoquant/streaming-ui` branch.
- **No backend.** Browser calls Anthropic directly. No Cloudflare Worker.
- **Example app only.** Lives in `_examples/kumo-stream/`. Nothing ships in `@cloudflare/kumo`.
- **Keep Anthropic SDK** for auth/streaming. Hook into its `onText` callback.
- **RFC 6902 JSON Patch** as the wire format (replace custom `UITreePatch` discriminated union).
- **No structural sharing** for now. Shallow copies on patch application. LLM trees are small (<50 elements). Optimize later if profiling warrants it.
- **No dependency on json-render** or any third-party JSON-to-UI library.

## Architecture

### Current Flow (broken)

```
LLM token stream → buffer += delta → extractUITree(buffer)
                                           │
                                      null until final }
                                           │
                                      setTree(parsed) ← everything at once
```

### Target Flow

```
LLM token stream → buffer += delta → split on \n → parse complete lines
                                                        │
                                              RFC 6902 JSON Patch
                                                        │
                                              applyPatch(spec, patch)
                                                        │
                                              setTree({...tree}) ← per-line re-render
```

### Key Insight

JSONL eliminates the incomplete-JSON problem. Each newline-delimited line is a complete, independently parseable JSON object. The LLM naturally generates tokens that accumulate into complete lines. We wait for `\n`, parse the line, apply the patch, re-render. No brace-depth counting, no partial-JSON recovery.

## System Prompt Change

The LLM must emit **JSONL patches** instead of a monolithic UITree. Each line is an RFC 6902 JSON Patch operation targeting a `Spec` object:

```typescript
interface Spec {
  root: string;
  elements: Record<string, UIElement>;
}
```

### Patch wire format (one JSON object per line)

```jsonl
{"op":"add","path":"/root","value":"card"}
{"op":"add","path":"/elements/card","value":{"key":"card","type":"Surface","props":{},"children":["heading"]}}
{"op":"add","path":"/elements/heading","value":{"key":"heading","type":"Text","props":{"children":"Schedule Your Follow-Up","variant":"heading2"},"parentKey":"card"}}
```

### Emission order matters for progressive UX

The system prompt must instruct the LLM to:

1. Emit `/root` first
2. Emit elements **top-down** (parent before children)
3. Include `children` arrays in the parent when emitting it — child element keys can reference elements that don't exist yet (renderer shows them once they arrive)
4. One element per line

This produces progressive rendering: Surface appears → heading appears inside it → inputs appear → buttons appear.

### Updating children arrays after initial emit

When the LLM emits a parent element, it may not know all children yet. Two strategies:

**Strategy A (pre-declare children):** LLM emits parent with full `children` array upfront. Renderer tolerates missing element keys (shows nothing for unresolved children). As each child element line arrives, it fills in.

**Strategy B (append children):** LLM emits parent with `children: []`, then uses `add` operations to append to the children array as new elements are created:

```jsonl
{"op":"add","path":"/elements/card","value":{"key":"card","type":"Surface","props":{},"children":[]}}
{"op":"add","path":"/elements/card/children/-","value":"heading"}
{"op":"add","path":"/elements/heading","value":{...}}
```

**Recommendation: Strategy A.** Fewer lines, simpler prompt, and the renderer already handles missing elements (shows `<div>Missing element: {key}</div>`). We just need to make the "missing" state silent (render nothing) rather than an error message during streaming.

## Deliverables

### D1: RFC 6902 Patch Application (M)

**Replace** `src/core/patches.ts` with a new `src/core/rfc6902.ts` that implements:

```typescript
// Minimal RFC 6902 subset needed for UITree streaming
interface JsonPatchOp {
  readonly op: "add" | "replace" | "remove";
  readonly path: string;
  readonly value?: unknown;
}

// Spec is the UITree shape under a different name to match the wire format
type Spec = UITree;

function applyPatch(spec: Spec, patch: JsonPatchOp): Spec;
function parsePatchLine(line: string): JsonPatchOp | null;
```

Only `add`, `replace`, `remove` needed. Skip `move`, `copy`, `test` — LLMs don't use them for generation.

Path format: RFC 6901 JSON Pointer (`/root`, `/elements/card`, `/elements/card/children/-` for array append).

**No structural sharing.** `applyPatch` returns a shallow copy of the top-level Spec on every call.

**Delete:** `patches.ts` (339 lines) and `__tests__/patches.test.ts` (519 lines).

**Depends on:** nothing

### D2: JSONL Line Parser (S)

**Replace** `src/core/json-extractor.ts` with a new `src/core/jsonl-parser.ts`:

```typescript
interface JsonlParser {
  /** Push a text chunk. Returns complete parsed lines. */
  push(chunk: string): JsonPatchOp[];
  /** Flush remaining buffer (call on stream end). */
  flush(): JsonPatchOp[];
}

function createJsonlParser(): JsonlParser;
```

Logic:

1. Accumulate text in internal buffer
2. Split on `\n`
3. Keep incomplete last line in buffer
4. For each complete line: strip whitespace, skip empty, attempt `JSON.parse`, validate has `op` + `path` fields, return as `JsonPatchOp`
5. Silently skip unparseable lines (LLM may emit markdown fences, text preamble, etc.)

**Depends on:** D1 (uses `JsonPatchOp` type)

### D3: Update `useUITree` Hook (S)

**Rewrite** `src/core/hooks.ts` to:

- Import `applyPatch` from `rfc6902.ts` instead of `patches.ts`
- Change `applyPatch` callback to accept `JsonPatchOp` instead of `UITreePatch`
- Drop `DataModel` — RFC 6902 patches don't need a separate data model (state lives in the Spec if needed)

```typescript
export function useUITree(): {
  readonly tree: UITree;
  readonly applyPatch: (patch: JsonPatchOp) => void;
  readonly applyPatches: (patches: JsonPatchOp[]) => void;
  readonly reset: () => void;
};
```

`applyPatches` applies multiple patches in a single `setState` call (batched re-render).

**Depends on:** D1

### D4: System Prompt — JSONL Mode (M)

**Rewrite** `src/core/system-prompt.ts` to instruct the LLM to:

1. Respond with **JSONL** (one JSON Patch operation per line), not a monolithic JSON blob
2. First line: set root — `{"op":"add","path":"/root","value":"card"}`
3. Subsequent lines: add elements top-down (parent before children)
4. Parent elements include full `children` array upfront
5. One element per line
6. No markdown fences, no explanations, no text — only JSONL lines

Keep all existing component documentation, design rules, anti-patterns, and the example — but convert the example from monolithic JSON to JSONL patch lines.

**Risk:** LLMs may not reliably follow JSONL format. Mitigations:

- Include 2-3 complete examples in the prompt
- The JSONL parser (D2) silently skips bad lines
- Test with Claude Sonnet 4 specifically (it's the configured model)

**Depends on:** nothing (but must be tested with D1+D2+D5 together)

### D5: Wire ChatDemo to Streaming Patches (M)

**Rewrite** `src/app/ChatDemo.tsx` to use the streaming pipeline:

1. Replace `useState<UITree>` with `useUITree()` hook
2. Replace `extractUITree` import with `createJsonlParser` + `applyPatch`
3. In `onText` callback:
   ```typescript
   onText: (delta) => {
     buffer += delta;
     setTextBuffer(buffer);
     const patches = parser.push(delta);
     for (const patch of patches) {
       applyPatch(patch);
     }
   };
   ```
4. In `onDone`: call `parser.flush()` and apply remaining patches
5. On new message / reset: call `reset()` and create a new parser

**UITreeRenderer change:** During streaming, missing element keys in `children` arrays should render as `null` (invisible) not as error divs. After streaming completes, missing keys are errors. Add a `streaming?: boolean` prop to `UITreeRenderer` or a context.

**Depends on:** D1, D2, D3, D4

### D6: Tests (M)

New test files:

1. **`__tests__/rfc6902.test.ts`** — Unit tests for `applyPatch`:
   - `add` to root path (`/root`)
   - `add` element to `/elements/{key}`
   - `add` to array with `/-` suffix
   - `replace` existing value
   - `remove` element
   - No-op on nonexistent path for `remove`
   - Invalid path handling

2. **`__tests__/jsonl-parser.test.ts`** — Unit tests for `createJsonlParser`:
   - Single complete line
   - Multiple lines in one chunk
   - Line split across chunks
   - Empty lines skipped
   - Invalid JSON skipped
   - Markdown fence lines skipped
   - Flush returns buffered incomplete line

3. **`__tests__/streaming-integration.test.ts`** — Integration test:
   - Simulate token-by-token delivery of a JSONL response
   - Verify tree grows incrementally (after N tokens, tree has M elements)
   - Verify final tree matches expected UITree

**Depends on:** D1, D2

## Execution Order

```
D1 (rfc6902.ts) ──┬──► D3 (useUITree) ──┐
                   │                      ├──► D5 (ChatDemo) ──► D6 (tests)
D2 (jsonl-parser)──┘                      │
D4 (system prompt) ───────────────────────┘
```

D1 + D2 + D4 can be done in parallel. D3 depends on D1. D5 depends on all. D6 can start with D1/D2 and finish after D5.

## Files Changed

| File                                          | Action              | Lines (est.)                                    |
| --------------------------------------------- | ------------------- | ----------------------------------------------- |
| `src/core/patches.ts`                         | **Delete**          | -339                                            |
| `src/__tests__/patches.test.ts`               | **Delete**          | -519                                            |
| `src/core/json-extractor.ts`                  | **Keep** (fallback) | 0                                               |
| `src/core/rfc6902.ts`                         | **Create**          | ~120                                            |
| `src/core/jsonl-parser.ts`                    | **Create**          | ~60                                             |
| `src/core/hooks.ts`                           | **Rewrite**         | ~35                                             |
| `src/core/system-prompt.ts`                   | **Rewrite**         | ~280                                            |
| `src/app/ChatDemo.tsx`                        | **Modify**          | ~30 lines changed                               |
| `src/core/UITreeRenderer.tsx`                 | **Modify**          | ~10 lines (streaming-tolerant missing elements) |
| `src/__tests__/rfc6902.test.ts`               | **Create**          | ~200                                            |
| `src/__tests__/jsonl-parser.test.ts`          | **Create**          | ~100                                            |
| `src/__tests__/streaming-integration.test.ts` | **Create**          | ~150                                            |

**Net:** Delete ~858 lines, create ~955 lines. Roughly neutral.

## Non-Goals

- **No Cloudflare Worker.** Streaming happens browser-side.
- **No `useCatalogStream` hook.** That's a library-level abstraction; this is an example app.
- **No `diffUITree`.** The LLM emits patches directly — no server-side diffing.
- **No loadable/UMD bundle.** `vite.loadable.config.ts` stays as-is (src/loadable/ still doesn't exist).
- **No structural sharing / React.memo optimization.** Deferred to post-validation.
- **No multi-turn conversation streaming.** Existing multi-turn works (prompt → full response → next prompt). Streaming improvements apply per-turn.
- **No `state` / `$bindState` / form interactivity.** Data model dropped. The UITree is display-only.

## Risks

| Risk                                                             | Likelihood | Impact                                                  | Mitigation                                                                                                                             |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| LLM doesn't follow JSONL format reliably                         | Medium     | High — no streaming at all                              | Multiple examples in prompt; JSONL parser silently skips bad lines; fallback to monolithic parse on stream end if zero patches applied |
| LLM emits parent after children (wrong order)                    | Low        | Medium — children briefly missing                       | Renderer tolerates missing keys during streaming; eventual consistency when parent arrives                                             |
| Token boundaries split UTF-8 characters                          | Low        | Low — mojibake in element keys                          | `TextDecoder` with `stream: true` handles this; Anthropic SDK already decodes for us                                                   |
| Anthropic SDK `onText` batches multiple lines in one delta       | High       | None — JSONL parser handles multi-line chunks by design |
| System prompt too long, reduces context for component generation | Low        | Medium                                                  | Prompt is already 228 lines; JSONL instructions add ~50 lines. Well within limits.                                                     |

## Acceptance Criteria

1. **Progressive rendering:** After sending a prompt, individual Kumo components appear incrementally as the LLM streams. The root container renders before its children. The user sees partial UI during generation, not a spinner then a snap.

2. **Correctness:** The final rendered UI after streaming completes is identical to what the monolithic approach would produce for the same prompt.

3. **Error resilience:** Malformed JSONL lines (markdown fences, text preamble, invalid JSON) are silently skipped without crashing the stream or the UI.

4. **No regressions:** Preset prompts still work. Multi-turn conversation still works. Stop button still works. Error states still display.

5. **Tests pass:** All new unit and integration tests pass via `pnpm --filter kumo-stream test`.

## Resolved Decisions

- **Batch re-renders:** All lines from a single `onText` delta are applied in one `setState` call via `applyPatches`. React 18 automatic batching ensures one render per delta.

- **Monolithic fallback:** Keep `extractUITree` as a fallback. In `onDone`, if `tree.root === ""` (no patches succeeded), attempt `extractUITree(buffer)` and `setTree(parsed)`. 3 lines of code, zero downside. Remove once prompt is battle-tested. `json-extractor.ts` is kept (not deleted) but demoted from primary parser to fallback.
