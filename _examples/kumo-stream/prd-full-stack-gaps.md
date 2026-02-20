# PRD: kumo-stream Full-Stack Alignment (actions, drift, progressive)

**Date:** 2026-02-20
**Branch:** `geoquant/streaming-ui` (only)

---

## Problem Statement

`kumo-stream` is unusually close to the end-to-end vision in `_examples/GENERATIVE-UI.md` (discovery via `/.well-known`, JSONL + RFC6902 streaming, per-element error boundaries, Zod validation via `@cloudflare/kumo/ai/schemas`, UMD host API). The remaining gaps are high leverage:

- **Real actions need real state.** `submit_form` cannot yet submit user-entered values (Input/Textarea) without prompt hacks.
- **Prompt drift is existential.** The system prompt is hand-curated and will drift from `ai/component-registry.json` + `ai/schemas.ts`.
- **Cross-boundary integrations duplicate logic.** HTML hosts reimplement action processing and scrape DOM instead of reading tree state.
- **Transport is demo-fragile.** SSE parsing is not spec-compliant enough; patch application can churn `flushSync()` under fast streams.
- **Progressive/no-JS lane is unclaimed.** DPU-aligned HTML streaming can make kumo-stream a best-in-class reference.

---

## Goals

- `submit_form` emits a robust submission payload from runtime-captured field values (no LLM stuffing `params`).
- System prompt and validation derive from the same source of truth (registry/schemas) to prevent drift.
- UMD host API supports real integrations (tree access + shared action runtime) without DOM scraping.
- Streaming path is resilient (multi-line SSE frames) and performant (patch batching).
- Optional experimental mode: DPU-aligned server-rendered HTML streaming for progressive/no-JS paint.

---

## Non-Goals

- Shipping these behaviors as part of `@cloudflare/kumo` (this PRD is `_examples/kumo-stream/` only).
- Per-element DPU markers in v1.
- Adding high-complexity overlay/app-shell components (Dialog/Popover/DropdownMenu/Combobox/etc.) to the generative surface in v1.

---

## Constraints (Critical)

- All work for this PRD lands on `geoquant/streaming-ui` branch.
- Prefer safe, battle-tested defaults over clever heuristics.
- Keep cross-boundary behavior explicit in `/.well-known/generative-ui.json`.

---

## Decisions (locked)

Recorded in `_examples/kumo-stream/decisions/`.

- JSONL + RFC6902 is the wire format (`0001`).
- ActionEvent + handler registry + ActionResult union is the interaction model (`0002`).
- Cross-boundary is UMD + `/.well-known` discovery (`0003`).
- `submit_form` uses host-managed value capture (action-scoped), not native DOM `<form>` / `FormData` (`0004`, `0005`).
- URL policy is allowlist by default (`0006`).
- DPU v1 is root snapshot replacement (`0007`).

---

## Proposed Solution (Phases)

### Phase 1: Value capture for real `submit_form`

Deliver

- Per-container value store keyed by `elementKey`.
- Value capture for `Input` and `Textarea`/`InputArea` (uncontrolled UI, capture on user interaction).
- `submit_form` builds payload from:
  - static `params` metadata
  - runtime-captured field values
- Guardrails:
  - include only field-like controls
  - touched-only by default
  - ambiguity fail-closed if multiple `submit_form` actions exist without explicit scoping
- Scoping escape hatches: `params.formKey` and `params.fieldKeys`.

Acceptance

- Typing into `Input`/`Textarea` is captured and included in `submit_form` payload.
- Default behavior does not include untouched defaults.
- Works in React SPA and `public/cross-boundary.html`.

### Phase 2: Prompt derivation from registry/schemas (anti-drift)

Deliver

- Generate the "Available Components" section from installed `@cloudflare/kumo` registry/schemas.
- Limit to kumo-stream supported set (component-map subset + aliases).
- Optionally serve prompt text from a well-known endpoint and advertise it.

Acceptance

- Prompt output is deterministic.
- Prompt never advertises props/types not accepted by schemas.

### Phase 2.1: Component surface expansion (shipped in `@cloudflare/kumo`)

Deliver

- Expand COMPONENT_MAP with low-risk declarative primitives:
  - Add: `Code`, `Field`, `Label`
  - Consider: `Breadcrumbs`, `ClipboardText`, `LayerCard`, `Pagination`, `Tooltip`
- Defer: overlays/app-shell/high-complexity/security-footgun components in v1.

Acceptance

- Added components render without host-specific wiring.
- Prompt + validation update in lockstep.

### Phase 3: Expand `/.well-known/generative-ui.json` capabilities

Deliver

- Add a `capabilities` section describing:
  - actions + built-ins
  - patch subset + array semantics
  - rendering modes
  - URL policy
  - value capture + `submit_form` defaults/guardrails

Acceptance

- Hosts can rely on discovery to understand behavior.

### Phase 4: UMD host API improvements

Deliver

- `getTree(containerId)` and `subscribeTree(containerId, cb)`.
- Export shared action runtime from UMD (`createHandlerMap`, `dispatchAction`, `processActionResult`).

Acceptance

- cross-boundary demo reads state from tree, not DOM.
- HTML hosts stop duplicating TS logic.

### Phase 5: Transport hardening + patch batching

Deliver

- SSE parser that supports multi-line `data:` and CRLF.
- Optional patch batching/throttling (e.g. rAF) to bound render frequency.

Acceptance

- Demo is resilient to SSE framing variations.
- Fast token streams do not produce pathological render churn.

### Phase 6 (optional, experimental): ShadowRoot + DPU-aligned no-JS mode

Deliver

- Optional ShadowRoot mount mode (style isolation) using a `<link rel="stylesheet">` to `/.well-known/stylesheet.css` inside the shadow root.
- Experimental DPU mode (light DOM): root snapshot replacement via streamed `<template for="kumo-ui">...</template>` targeting a single marker range.

Acceptance

- Feature-gated; default JSONL+rfc6902 mode unchanged.

---

## Risks & Mitigations

- **Implicit value capture leaks data.** Mitigate with field-like + touched-only + scoping escape hatches + fail-closed multi-submit.
- **Prompt generation adds build/runtime complexity.** Mitigate with deterministic tests + generated prompt endpoint optional.
- **UMD API surface creep.** Mitigate by exporting only stable primitives and documenting in capabilities.
- **DPU mode divergence.** Mitigate by making it experimental, root-snapshot-only, and explicitly separate from JSONL patch mode.

---

## References

- `_examples/kumo-stream/specs/full-stack-gaps.md`
- `_examples/GENERATIVE-UI.md`
- `_examples/kumo-stream/decisions/`
