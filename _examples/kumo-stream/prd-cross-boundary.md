# PRD: Cross-Boundary Generative UI

**Date:** 2026-02-19

---

## Problem Statement

### What problem are we solving?

`kumo-stream` proves that JSONL streaming (RFC 6902 patches) is a superior model for progressive UI rendering — but only inside its own React app. It cannot prove the core thesis of GENERATIVE-UI.md: that **any website** (ChatGPT, a plain HTML page, a non-React app) can render Cloudflare Kumo components progressively via a `<script>` tag.

The boss's `kumo-provider` proved cross-boundary distribution (UMD bundle, theme events) but uses fragile partial-JSON brace-counting for streaming. Neither project alone proves all 4 pillars of GENERATIVE-UI.md.

### Why now?

`kumo-stream` already has the hard parts: JSONL parser, RFC 6902 engine, progressive `UITreeRenderer` with streaming tolerance. The loadable Vite config exists. The gap is small but the demo is incomplete without it.

### Who is affected?

- **Primary:** Team evaluating whether kumo's generative UI approach works end-to-end
- **Secondary:** External consumers (ChatGPT, partner sites) who would load kumo components via UMD

---

## Proposed Solution

### Overview

Add four things to `kumo-stream`: (1) a UMD loadable entry that exposes `window.CloudflareKumo` with patch-aware rendering, (2) a thin Express server that proxies Anthropic API calls via SSE, (3) theme support in the renderer, and (4) a plain HTML demo page that proves all 4 GENERATIVE-UI.md pillars with zero React in the host page.

### User Flow: Cross-Boundary Streaming

1. User opens `localhost:3001/cross-boundary.html` (plain HTML, no React)
2. User types a prompt and clicks "Generate"
3. HTML page `fetch()`es `/api/chat` with the prompt
4. Express server streams Anthropic response as SSE text deltas
5. HTML page feeds deltas to `CloudflareKumo.createParser().push(delta)`
6. Each parsed patch op is applied via `CloudflareKumo.applyPatch(op, 'container')`
7. Kumo components appear progressively in the page
8. User clicks "Toggle Theme" → components switch light/dark via `CloudflareKumo.setTheme('dark')`

### User Flow: Existing React SPA (preserved)

1. User opens `localhost:4200` (Vite dev server, unchanged)
2. Existing `ChatDemo.tsx` pipeline works as before: client-side Anthropic SDK → JSONL parser → `useUITree()` → `UITreeRenderer`

---

## End State

When this PRD is complete, the following will be true:

- [ ] UMD bundle builds to `dist/loadable/component-loadable.umd.js` via `pnpm build:loadable`
- [ ] A plain HTML page can load the UMD bundle and render streaming kumo components with zero React in the host
- [ ] Express proxy server at `:3001` streams Anthropic responses as SSE, API key stays server-side
- [ ] Theme switching works cross-boundary (`setTheme('light'|'dark')` dispatches event, components react)
- [ ] Existing React SPA at `:4200` continues to work unchanged
- [ ] TypeScript compiles, all tests pass

---

## Acceptance Criteria

### Feature: UMD Loadable Bundle

- [ ] `src/loadable/index.ts` exists and exports `window.CloudflareKumo`
- [ ] `CloudflareKumo.applyPatch(op, containerId)` applies a single RFC 6902 op to internal tree state, re-renders
- [ ] `CloudflareKumo.applyPatches(ops, containerId)` applies multiple ops in one render
- [ ] `CloudflareKumo.renderTree(tree, containerId)` replaces entire tree (one-shot, non-streaming use)
- [ ] `CloudflareKumo.createParser()` returns a JSONL parser instance (`push`/`flush`)
- [ ] `CloudflareKumo.setTheme(mode)` switches light/dark
- [ ] `CloudflareKumo.reset(containerId)` clears tree and container
- [ ] React is bundled inside (not externalized) — self-contained `<script>` tag
- [ ] `pnpm build:loadable` succeeds, outputs to `dist/loadable/`

### Feature: Express Proxy Server

- [ ] `server/index.ts` exists with Express SSE endpoint
- [ ] `POST /api/chat` accepts `{ message, history? }` body
- [ ] Server streams text deltas as SSE: `data: {"type":"text","delta":"..."}\n\n`
- [ ] Server sends `data: {"type":"done"}\n\n` on completion
- [ ] Server sends `data: {"type":"error","message":"..."}\n\n` on failure
- [ ] API key read from `ANTHROPIC_API_KEY` env var (not `VITE_` prefixed)
- [ ] CORS enabled for local dev
- [ ] Serves `dist/loadable/` and `public/` as static files
- [ ] `pnpm serve` starts the server

### Feature: Theme Support

- [ ] `UITreeRenderer` accepts `mode` prop (`'light' | 'dark'`), defaults to `'light'`
- [ ] Loadable's `ThemeWrapper` listens for `kumo-theme-change` CustomEvent on `window`
- [ ] `setTheme()` sets `data-mode` on both the wrapper div and `document.body` (for portalled elements)
- [ ] Theme change is reactive (components re-render in new mode)

### Feature: Cross-Boundary Demo

- [ ] `public/cross-boundary.html` exists — plain HTML, no build step, no React
- [ ] Loads UMD bundle via `<script src="/dist/loadable/component-loadable.umd.js">`
- [ ] Has prompt input + "Generate" button + theme toggle
- [ ] Connects to `/api/chat` SSE endpoint
- [ ] Feeds deltas to `CloudflareKumo.createParser()` → `CloudflareKumo.applyPatch()`
- [ ] Kumo components render progressively inside a container div
- [ ] Theme toggle switches light/dark mode

---

## Technical Context

### Existing Patterns

- `src/core/rfc6902.ts` — Patch engine, reuse as-is in loadable
- `src/core/jsonl-parser.ts` — JSONL parser, expose via `createParser()`
- `src/core/UITreeRenderer.tsx` — Renderer with `streaming` prop, wrap in loadable
- `src/core/component-map.ts` — 16 components mapped, reuse as-is
- `_examples/kumo-provider/src/loader.tsx` — Reference for `flushSync`, `_roots` Map, `ThemeWrapper` patterns

### Key Files

- `vite.loadable.config.ts` — Already configured, entry: `src/loadable/index.ts`
- `src/core/system-prompt.ts` — Used by both React SPA and server proxy
- `src/core/stream-client.ts` — Browser-side client (SPA only, not used by server)

### System Dependencies

- `express` + `cors` — new server deps (add to package.json devDependencies)
- `@anthropic-ai/sdk` — already a dependency, used server-side now too
- `dotenv` — for server env loading

---

## Risks & Mitigations

| Risk                                                          | Likelihood | Impact | Mitigation                                                                     |
| ------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------ |
| UMD bundle size too large (React + Kumo + 16 components)      | Low        | Medium | Expect ~200-300KB gzip; acceptable for cross-boundary demo                     |
| `flushSync` needed for immediate DOM updates during streaming | Medium     | Medium | Copy pattern from kumo-provider; test empirically                              |
| CSS not loading correctly in cross-boundary context           | Medium     | High   | `cssCodeSplit: false` in loadable config; verify CSS is extracted              |
| Kumo components require Tailwind runtime in host page         | Medium     | High   | Verify standalone CSS (`@cloudflare/kumo/styles/standalone`) bundles correctly |

---

## Non-Goals (v1)

- **Dynamic registry fetching** — 16 hardcoded components proves the pattern; defer registry URL fetching
- **Stateful component wrappers** — no Combobox/Dialog/Popover wrappers; stateless proves architecture
- **Full 38-component parity** — 16 is sufficient for the demo
- **Cloudflare Worker deployment** — local Express only
- **Production security** — no rate limiting, auth, or input validation beyond API key
- **Animation/transitions** — no MutationObserver fade-in (kumo-provider's polish, defer)
- **Multi-turn in cross-boundary demo** — single prompt only; React SPA has multi-turn

---

## Open Questions

| Question                                                                                                  | Status                                             |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Should loadable CSS be a separate file or inlined in the UMD bundle?                                      | Open — test both, prefer separate for cacheability |
| Does `@cloudflare/kumo/styles/standalone` work inside a UMD build, or do we need to extract/copy the CSS? | Open — needs investigation during loadable task    |

---

## Appendix

### GENERATIVE-UI.md Pillar Coverage

| Pillar                 | How Proven                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| 1. Dynamic Loadable    | UMD bundle at `dist/loadable/`, loads via `<script>`             |
| 2. Component Response  | UITree + RFC 6902 patches (existing)                             |
| 3. Component Styles    | `setTheme()` + `ThemeWrapper` + `kumo-theme-change` event        |
| 4. Streaming Responses | JSONL pipeline: each line independently valid, no brace-counting |
