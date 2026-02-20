# Spec: kumo-stream "full stack" gaps (actions, drift, progressive)

**Branch:** `geoquant/streaming-ui` (only)
**Status:** Draft
**Date:** 2026-02-20

This spec captures the remaining high-leverage work to align kumo-stream with `_examples/GENERATIVE-UI.md`.

References

- `_examples/GENERATIVE-UI.md`
- ADRs: `_examples/kumo-stream/decisions/`

## Goals

- Real "form submit" semantics: `submit_form` emits user-entered values without LLM stuffing `params`.
- Reduce prompt/spec drift: system prompt derives from the same sources as validation (registry/schemas).
- Make UMD host integration real: expose tree state + shared action runtime; stop DOM scraping + duplicated JS.
- Transport hardening: spec-compliant-ish SSE parsing; patch batching to reduce `flushSync()` churn.
- Optional progressive/no-JS rendering path aligned with WICG DPU.

## Decisions already made

- Wire format: JSONL + RFC6902 streaming (`decisions/0001-*.md`).
- Interactions: ActionEvent + handler registry + ActionResult union (`decisions/0002-*.md`).
- Cross-boundary: UMD + `/.well-known` discovery (`decisions/0003-*.md`).
- `submit_form` value capture + defaults + guardrails (`decisions/0004-*.md`).
- Forms are action-scoped, not DOM `<form>`/`FormData` in v1 (`decisions/0005-*.md`).

## Phase 1: Value capture for real submit_form (highest priority)

Problem

- Current wrappers emit runtime context for select/toggles, but `Input`/`Textarea` typed values are not captured.
- `submit_form` only serializes `event.params || event.context`, so forms feel fake.

Plan

- Add a per-container value store keyed by `elementKey`.
- Add value capture for `Input` and `Textarea`/`InputArea` (uncontrolled UI, but publish values into store on user interaction).
- Change `submit_form` to construct a submission payload from:
  - static `params` metadata
  - runtime-captured field values (guardrails: field-like + touched-only)
- Ambiguity rule: if multiple `submit_form` actions exist in the container and no explicit scoping is provided, return `none` and log warning.
- Scoping escape hatches:
  - `params.formKey`: collect only fields under that subtree
  - `params.fieldKeys`: collect only listed keys

Acceptance

- Typing into `Input` and `Textarea` is captured and included in `submit_form` payload.
- Default behavior collects touched-only values for field-like controls.
- Multi-submit ambiguity fails closed.
- Works in React SPA and `public/cross-boundary.html`.

## Phase 2: Prompt derivation from registry/schemas (anti-drift)

Plan

- Generate the "Available Components" and action guidance from installed `@cloudflare/kumo` registry/schemas.
- Ensure the generated prompt lists only components actually supported by kumo-stream (component-map subset + aliases).
- Optionally serve prompt text via a well-known path and advertise it.

Acceptance

- Prompt output is deterministic and matches the validated component set.
- No prompt mentions props/types that schemas reject.

## Phase 3: Expand `/.well-known/generative-ui.json` capabilities

Plan

- Add `capabilities` describing:
  - actions supported (built-ins)
  - patch subset + array semantics
  - rendering modes
  - security URL policy
  - value-capture + `submit_form` defaults/guardrails

Acceptance

- A host can determine behavior without reading source.

## Phase 4: UMD host API improvements

Plan

- Add `getTree(containerId)` and `subscribeTree(containerId, cb)`.
- Export shared action runtime (`createHandlerMap`, `dispatchAction`, `processActionResult`) from UMD so `public/cross-boundary.html` stops duplicating logic.

Acceptance

- cross-boundary demo reads state from tree, not DOM.
- No duplicated action registry/result processor in HTML.

## Phase 5: Transport hardening + patch batching

Plan

- Replace demo SSE parsing with a multi-line `data:`-aware parser (CRLF tolerant).
- Add optional patch batching/throttling (e.g. apply at `requestAnimationFrame`) to reduce render churn.

Acceptance

- Streaming is resilient to multi-line SSE frames.
- Patch application rate is bounded; UI remains responsive under fast streams.

## Phase 6 (optional): ShadowRoot + DPU-aligned no-JS mode

ShadowRoot

- Optional UMD mode: render into ShadowRoot for style isolation.
- CSS strategy: inject `<link rel="stylesheet">` pointing at `/.well-known/stylesheet.css` inside the shadow root.

DPU (no-JS progressive)

- MVP: server renders HTML snapshots of current UI and streams `<template for="kumo-ui">...</template>` targeting a single marker range (`<?start name="kumo-ui">...<?end ...>`).
- Explicitly note: DPU templates must be in the same tree scope as the target, so v1 DPU implies light DOM (ShadowRoot requires JS-driven streaming into that scope).

Acceptance

- Feature-gated; default JSONL+rfc6902 path unchanged.

## Open questions (still need decisions)

Decisions (2026-02-20)

- `submit_form` result shape: both.
  - Registry/host produces a typed payload object for integrations.
  - A stable string serialization exists as a fallback for chat injection/back-compat.
- URL policy (safe-by-default): allow only `http:`, `https:`, and relative URLs.
  - Block at least: `javascript:`, `data:`, `file:`.
  - `mailto:`/`tel:` are opt-in via host callback/capability flag (not default).
- DPU scope (v1): root snapshot only.
  - Single marker range (e.g. `kumo-ui`) replaced by streamed `<template for="kumo-ui">...</template>`.
  - Per-element markers are explicitly deferred.
