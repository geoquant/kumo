# PRD: Real Streaming via JSONL Patches

**Date:** 2026-02-19

---

## Problem Statement

### What problem are we solving?

kumo-stream renders LLM-generated UI atomically: the user sees a spinner for the entire generation duration, then the complete UI snaps in all at once. This happens because `extractUITree()` requires a fully-formed JSON object before it can parse — returning `null` on every streamed token until the final closing brace.

The infrastructure for progressive rendering (a 339-line patch engine, a `useUITree` hook, a 519-line test suite) already exists in the codebase but is completely bypassed by `ChatDemo.tsx`, which uses raw `useState<UITree>` and monolithic `setTree()` directly.

The result: kumo-stream cannot demonstrate the progressive streaming UX that makes LLM-driven UI compelling. Components should appear one-by-one as the LLM generates them — root container first, then children filling in — instead of the current all-or-nothing experience.

### Why now?

This example app is the proving ground for eventually shipping streaming UI technology in `@cloudflare/kumo` proper. The atomic rendering makes kumo-stream a poor stress test — it doesn't exercise the streaming path at all. We need progressive rendering validated in the example before we can design the library-level abstraction.

The json-render example already demonstrates progressive rendering in production. kumo-stream should achieve parity using Kumo's own component infrastructure.

### Who is affected?

- **Primary users:** Developers evaluating kumo-stream as a reference implementation for LLM-driven UI with Kumo components
- **Secondary users:** The Kumo team — this example validates the feasibility of shipping streaming UI primitives in `@cloudflare/kumo`

---

## Proposed Solution

### Overview

Replace the monolithic JSON extraction pipeline with JSONL (newline-delimited JSON) streaming. The LLM emits one RFC 6902 JSON Patch operation per line instead of a single large JSON blob. Each completed line is independently parseable, eliminating the incomplete-JSON problem entirely. As each line arrives, the patch is applied to the UI tree and React re-renders — producing progressive, component-by-component rendering.

### User Experience

#### User Flow: Send a Prompt

1. User types a prompt or clicks a preset button
2. Streaming begins — the right panel shows a loading indicator
3. The root container (e.g., a Surface) appears within the first few tokens
4. Child components fill in progressively: heading, then inputs, then buttons
5. The user sees partial, growing UI during the entire generation
6. Streaming completes — the final UI is identical to what monolithic rendering would produce

#### User Flow: Error During Stream

1. LLM emits malformed lines (markdown fences, preamble text, broken JSON)
2. The JSONL parser silently skips these lines
3. Valid patch lines continue to apply normally
4. The user sees no error — rendering continues with whatever valid patches arrive

#### User Flow: Stop Mid-Stream

1. User clicks Stop while components are streaming in
2. Generation halts — the partially-built UI remains visible as-is
3. The user sees whatever components had streamed in up to that point

---

## End State

When this PRD is complete, the following will be true:

- [ ] LLM emits JSONL patch lines instead of monolithic JSON
- [ ] Components render progressively as the LLM streams (root first, children after)
- [ ] The custom patch system (`patches.ts`, 339 lines) and its tests (`patches.test.ts`, 519 lines) are deleted
- [ ] A minimal RFC 6902 `applyPatch` function replaces the custom patch engine
- [ ] A JSONL line parser handles text accumulation and line splitting
- [ ] `useUITree` hook is rewritten to accept RFC 6902 patches
- [ ] `ChatDemo.tsx` uses the streaming pipeline instead of monolithic `setTree()`
- [ ] `UITreeRenderer` tolerates missing element keys during streaming (renders nothing, not error divs)
- [ ] Malformed JSONL lines are silently skipped
- [ ] All existing functionality preserved: presets, multi-turn conversation, stop button, error states
- [ ] New test suites cover RFC 6902 application, JSONL parsing, and end-to-end streaming integration
- [ ] Tests pass via `pnpm --filter kumo-stream test`

---

## Success Metrics

### Qualitative

- Visual confirmation that components appear incrementally during LLM streaming — root container renders before children, children fill in one-by-one
- Final rendered UI after streaming completes is visually identical to what monolithic rendering would produce for the same prompt
- No visible errors or flicker during progressive rendering
- Preset prompts, multi-turn, and stop all continue to work as before

---

## Acceptance Criteria

### Progressive Rendering

- [ ] After sending a prompt, individual Kumo components appear incrementally as the LLM streams
- [ ] The root container renders before its children
- [ ] The user sees partial UI during generation, not a spinner then a snap

### Correctness

- [ ] The final rendered UI after streaming completes matches what monolithic rendering would produce for the same prompt
- [ ] Patches apply in order: `/root` first, then parent elements before children

### Error Resilience

- [ ] Malformed JSONL lines (markdown fences, text preamble, invalid JSON) are silently skipped
- [ ] Skipped lines do not crash the stream or the UI
- [ ] Missing element keys in `children` arrays render as nothing (invisible) during streaming

### No Regressions

- [ ] All 7 preset prompts still work
- [ ] Multi-turn conversation still works
- [ ] Stop button still works
- [ ] Error states still display correctly

### Tests

- [ ] RFC 6902 `applyPatch` unit tests pass (add/replace/remove, array append, invalid paths)
- [ ] JSONL parser unit tests pass (complete lines, split chunks, empty lines, invalid JSON skipped)
- [ ] Streaming integration test passes (token-by-token delivery produces incrementally growing tree)
- [ ] All tests pass via `pnpm --filter kumo-stream test`

---

## Technical Context

### Existing Patterns

- **Flat UITree format:** `{ root: string, elements: Record<string, UIElement> }` — re-exported from `@cloudflare/kumo/catalog` in `src/core/types.ts`
- **Recursive rendering:** `UITreeRenderer.tsx` walks the flat element map starting from `root`, resolving children by key lookup. Already handles unknown keys (shows error div) — needs modification to silently skip during streaming
- **Anthropic SDK streaming:** `stream-client.ts` wraps `client.messages.stream()` with `onText(delta)`, `onDone()`, `onError()` callbacks. `onText` receives string deltas (already decoded, no UTF-8 concerns)
- **React 18 batching:** Multiple `setState` calls within the same event handler are batched into a single render — `applyPatches` leveraging this for multi-line deltas

### Key Files

| File                                        | Relevance                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/app/ChatDemo.tsx` (298 lines)          | Main orchestrator — currently uses monolithic `setTree()`, must be rewired to streaming pipeline |
| `src/core/json-extractor.ts` (94 lines)     | Current monolithic parser — kept as optional fallback, demoted from primary                      |
| `src/core/system-prompt.ts` (228 lines)     | LLM instructions — must be rewritten to request JSONL patch output                               |
| `src/core/UITreeRenderer.tsx` (236 lines)   | Tree renderer — needs `streaming` mode to tolerate missing element keys                          |
| `src/core/hooks.ts` (45 lines)              | `useUITree` hook — must be rewritten for RFC 6902 patches, drop `DataModel`                      |
| `src/core/patches.ts` (339 lines)           | Custom patch engine — **to be deleted** (replaced by RFC 6902)                                   |
| `src/__tests__/patches.test.ts` (519 lines) | Custom patch tests — **to be deleted**                                                           |
| `src/core/stream-client.ts` (99 lines)      | Anthropic SDK wrapper — unchanged                                                                |
| `src/core/component-map.ts` (80 lines)      | Type-to-component lookup — unchanged                                                             |
| `src/core/types.ts` (33 lines)              | Type re-exports — unchanged                                                                      |

### Wire Format

JSONL (one RFC 6902 JSON Patch operation per line), targeting a `Spec` object:

```typescript
interface Spec {
  root: string;
  elements: Record<string, UIElement>;
}
```

Example stream:

```jsonl
{"op":"add","path":"/root","value":"card"}
{"op":"add","path":"/elements/card","value":{"key":"card","type":"Surface","props":{},"children":["heading"]}}
{"op":"add","path":"/elements/heading","value":{"key":"heading","type":"Text","props":{"children":"Schedule Your Follow-Up","variant":"heading2"},"parentKey":"card"}}
```

### New Modules

| Module                                 | Purpose                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/rfc6902.ts` (~120 lines)     | `applyPatch(spec, patch)` — minimal RFC 6902 subset (add/replace/remove only). RFC 6901 JSON Pointer paths. Shallow copy on every call. |
| `src/core/jsonl-parser.ts` (~60 lines) | `createJsonlParser()` — accumulates text, splits on `\n`, returns parsed `JsonPatchOp[]` per chunk. Silently skips unparseable lines.   |

### Key Interfaces

```typescript
// RFC 6902 patch operation (add/replace/remove only)
interface JsonPatchOp {
  readonly op: "add" | "replace" | "remove";
  readonly path: string;
  readonly value?: unknown;
}

// JSONL line parser
interface JsonlParser {
  push(chunk: string): JsonPatchOp[];
  flush(): JsonPatchOp[];
}

// Updated useUITree hook
function useUITree(): {
  readonly tree: UITree;
  readonly applyPatch: (patch: JsonPatchOp) => void;
  readonly applyPatches: (patches: JsonPatchOp[]) => void;
  readonly reset: () => void;
};
```

### System Dependencies

- `@anthropic-ai/sdk` — unchanged, provides `onText` streaming callback
- `@cloudflare/kumo` — unchanged, provides components and `UITree`/`UIElement` types
- No new package dependencies required

---

## Risks & Mitigations

| Risk                                                                   | Likelihood | Impact                              | Mitigation                                                                                                                                  |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM doesn't follow JSONL format reliably                               | Medium     | High — no streaming at all          | Multiple examples in system prompt; JSONL parser silently skips bad lines; optional monolithic fallback in `onDone` if zero patches applied |
| LLM emits children before parents (wrong order)                        | Low        | Medium — children briefly invisible | Renderer tolerates missing keys during streaming; eventual consistency when parent arrives                                                  |
| System prompt length increase reduces context for component generation | Low        | Medium                              | Current prompt is 228 lines; JSONL instructions add ~50 lines. Well within model context limits                                             |
| Anthropic SDK `onText` batches multiple lines in one delta             | High       | None                                | JSONL parser handles multi-line chunks by design; `applyPatches` batches multiple patches into single `setState`                            |
| Token boundaries split mid-line                                        | High       | None                                | JSONL parser buffers incomplete lines until next `\n`; Anthropic SDK already handles UTF-8 decoding                                         |

---

## Alternatives Considered

### Alternative 1: Incremental JSON Parser (Partial Parsing)

- **Description:** Use a streaming JSON parser that emits partial objects as tokens arrive (e.g., `@streamparser/json`)
- **Pros:** No LLM prompt changes needed — same monolithic JSON output
- **Cons:** Complex partial-object state management; hard to know when a subtree is "complete enough" to render; fragile with nested objects
- **Decision:** Rejected. JSONL gives clean line boundaries — each line is independently parseable with zero ambiguity.

### Alternative 2: Keep Custom Patch System, Add JSONL Transport

- **Description:** Keep the existing `UITreePatch` discriminated union but have the LLM emit those types as JSONL
- **Pros:** Preserves structural sharing; existing tests remain valid
- **Cons:** 9-variant discriminated union is complex for LLM to follow; RFC 6902 is a well-known standard with simpler semantics; custom format adds maintenance burden
- **Decision:** Rejected. RFC 6902 is simpler for LLMs to emit reliably and is a recognized standard.

### Alternative 3: Server-Side Diffing with Cloudflare Worker

- **Description:** Run a Worker that receives the full LLM response and emits diffs to the client
- **Pros:** Full control over patch generation; LLM output format doesn't matter
- **Cons:** Violates "no backend" constraint; adds infrastructure dependency; increases latency; the goal is to stress-test browser-side streaming
- **Decision:** Rejected. The example app deliberately avoids a backend to prove the browser-side streaming path.

---

## Non-Goals (v1)

- **No Cloudflare Worker** — streaming happens entirely browser-side
- **No `useCatalogStream` hook** — that's a library-level abstraction; this is an example app. Library integration comes after validation here
- **No `diffUITree`** — the LLM emits patches directly; no server-side diffing
- **No structural sharing / React.memo optimization** — shallow copies on every patch. Trees are small (<50 elements). Optimize later if profiling warrants
- **No multi-turn streaming improvements** — existing multi-turn works (prompt -> full response -> next prompt). Streaming improvements apply per-turn only
- **No `state` / `$bindState` / form interactivity** — `DataModel` dropped from hook. The UITree is display-only
- **No loadable/UMD bundle** — `vite.loadable.config.ts` stays as-is (entry point still doesn't exist)
- **Library integration** — eventual goal is shipping streaming UI primitives in `@cloudflare/kumo`, but that's explicitly deferred until this example validates the approach

---

## Interface Specifications

### Wire Format (LLM -> Browser)

```
Content-Type: text/event-stream (via Anthropic SDK)

Each text delta contains partial JSONL. Complete lines are:

{"op":"add","path":"/root","value":"<rootKey>"}
{"op":"add","path":"/elements/<key>","value":{...UIElement...}}
{"op":"replace","path":"/elements/<key>/props/<prop>","value":<newValue>}
{"op":"remove","path":"/elements/<key>"}
```

### Emission Order Contract

1. `/root` must be emitted first
2. Parent elements before children (top-down)
3. Parent `children` arrays declared upfront (Strategy A — renderer tolerates missing keys)
4. One element per line
5. No markdown fences, no explanations — JSONL only

---

## Documentation Requirements

- [ ] Update any inline code comments in modified files
- [ ] System prompt itself serves as the LLM-facing "documentation" for the wire format

---

## Open Questions

| Question                                                                                     | Owner       | Status |
| -------------------------------------------------------------------------------------------- | ----------- | ------ |
| Should `json-extractor.ts` monolithic fallback be wired in `onDone`, or deferred entirely?   | Implementer | Open   |
| Should `UITreeRenderer` use a `streaming` prop or React context for missing-key tolerance?   | Implementer | Open   |
| What happens if LLM emits `replace` for an element that doesn't exist yet? (Treat as `add`?) | Implementer | Open   |

---

## Appendix

### Glossary

- **JSONL:** Newline-delimited JSON. Each line is a complete, independently parseable JSON object.
- **RFC 6902:** JSON Patch standard — describes operations (`add`, `replace`, `remove`, `move`, `copy`, `test`) on a JSON document using JSON Pointer paths.
- **RFC 6901:** JSON Pointer standard — path syntax like `/elements/card/children/0`.
- **UITree:** Kumo's flat UI representation: `{ root: string, elements: Record<string, UIElement> }`.
- **Spec:** Alias for UITree in the wire format context.
- **Strategy A:** Parent declares full `children` array upfront; renderer tolerates unresolved keys.

### References

- Original spec: `_examples/kumo-stream/specs/streaming-patches.md`
- Existing patch engine (to be deleted): `src/core/patches.ts`
- json-render example (reference implementation): `_examples/json-render/`
- RFC 6902 JSON Patch: https://datatracker.ietf.org/doc/html/rfc6902
- RFC 6901 JSON Pointer: https://datatracker.ietf.org/doc/html/rfc6901
