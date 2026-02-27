# PRD: Streaming UI Playground

**Date:** 2026-02-26

---

## Problem Statement

### What problem are we solving?

The existing streaming UI demo on `/streaming` is embedded in a documentation page with ~1000 lines of surrounding prose. The rendered output is constrained to a small viewport area (200-520px max-height) inside a chat bubble. This makes it impossible to evaluate page-level generative UI (multi-section layouts, two-column templates, sticky sidebars). There is no way to:

1. **See the generated code** — developers can't go from "AI generated this" to "here's the code for my codebase"
2. **Inspect structural quality** — the 8 structural graders exist but aren't surfaced in the UI
3. **Switch models** — hardcoded to one Workers AI model with no comparison ability
4. **Iterate conversationally** — current demo is single-turn only, no refinement
5. **View the system prompt** — the prompt that shapes output is invisible to developers

This blocks the style-layer work (composition graders, page-level templates, design judgment rules) because there's no feedback loop to evaluate whether changes to the prompt or grading rules actually improve output quality.

### Why now?

The streaming pipeline infrastructure is complete (JSONL parser, RFC 6902 patches, UITree renderer, 8 normalization passes, structural graders, action system). The next phase — page-level composition quality — requires a full-width playground with code output and grading visibility. Without it, the style-layer plan has no iteration mechanism.

### Who is affected?

- **Primary users:** Internal Kumo team (engineers iterating on generative UI quality, prompt engineering, composition rules)
- **Secondary users:** External developers evaluating streaming UI capabilities for their products

---

## Proposed Solution

### Overview

A new `/playground` route in the Kumo docs site (`packages/kumo-docs-astro`) that provides a full-width, tab-based development environment for streaming generative UI. Users enter natural language prompts, see the generated UI rendered live, view the equivalent JSX code, inspect structural grading results, and read the system prompt — all in one interface. Multi-turn conversation allows iterative refinement. Model switching enables comparison across Workers AI models. Access is gated behind a simple shared secret.

### User Experience

#### User Flow: First Generation

1. User navigates to `/playground?key=<secret>`
2. Playground loads full-width (no sidebar, no max-width constraint)
3. User types a prompt in the top input bar: "Build a DNS zone management page with active zones, query metrics, and documentation links"
4. User clicks Send (or presses Enter)
5. Preview tab shows UITreeRenderer output streaming live — full-width, scrollable
6. User switches to Code tab — sees JSX being generated live as tree updates
7. Stream completes. User clicks Copy to copy JSX to clipboard
8. User switches to Grading tab — sees 8/8 structural rules passing, element count, tree depth

#### User Flow: Conversational Refinement

1. After first generation, follow-up input appears at bottom
2. User types: "Add a search bar above the zones table"
3. Tree resets, new stream starts with full conversation history
4. Model generates updated UI incorporating the refinement
5. All tabs update with new output

#### User Flow: Model Comparison

1. User selects a different model from the dropdown in the top bar
2. User re-sends the same prompt (or types a new one)
3. Output renders with the new model — user can compare quality by switching tabs

#### User Flow: System Prompt Inspection

1. User clicks the "System Prompt" tab
2. Sees the full assembled system prompt (read-only) that the model receives
3. Can understand what rules, examples, and component docs shape the output

### Design Considerations

- **Full-width layout:** Uses `BaseLayout` (no sidebar, no `max-w-5xl` constraint) to maximize viewport for page-level UI
- **Tab-based navigation:** 4 tabs (Preview, Code, Grading, System Prompt) — tabs persist across generations
- **No syntax highlighting in v1:** Code tab uses `<pre>` with monospace font. Syntax highlighting (Shiki/Prism) deferred to v2
- **Responsive:** Playground should work on desktop viewports (>=1024px). Mobile is not a priority for a dev tool
- **Semantic tokens only:** All playground UI uses Kumo semantic tokens (`bg-kumo-base`, `text-kumo-default`, etc.)

---

## End State

When this PRD is complete, the following will be true:

- [ ] `/playground?key=<secret>` route exists and loads a full-width playground
- [ ] `uiTreeToJsx()` is exported from `@cloudflare/kumo/generative` with unit tests
- [ ] Users can type prompts and see live rendered UI in the Preview tab
- [ ] Code tab shows valid, copyable JSX with `@cloudflare/kumo` imports
- [ ] Grading tab shows `gradeTree()` results (score, per-rule pass/fail, violations)
- [ ] System Prompt tab shows the assembled prompt text (read-only)
- [ ] Multi-turn conversation works (follow-up prompts refine output)
- [ ] Model selector switches between 3 Workers AI models
- [ ] Access is gated behind `PLAYGROUND_SECRET` (query param + header)
- [ ] `readSSEStream` is extracted to a shared utility (no code duplication)
- [ ] `/api/chat` accepts `messages` array and `model` override (playground-auth required)
- [ ] Navigation updated (sidebar, search, cross-link from `/streaming`)
- [ ] Existing `/streaming` demo works identically (no regressions)
- [ ] All work is on the `geoquant/streaming-ui` branch

---

## Success Metrics

### Quantitative

| Metric                                   | Current                            | Target                                     | Measurement Method                      |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------ | --------------------------------------- |
| Page-level prompts renderable            | 0 (constrained viewport)           | Any page-level template renders full-width | Manual testing with NS template prompts |
| Time from "AI output" to "copyable code" | N/A (no code output)               | <1s after stream completes                 | Code tab updates live during stream     |
| Structural grading visibility            | 0 (graders exist but not surfaced) | All 8 rules visible per generation         | Grading tab shows full GradeReport      |
| Models available for comparison          | 1 (hardcoded)                      | 3                                          | Model selector dropdown                 |

### Qualitative

- Team can iterate on system prompt changes and immediately see impact on output quality
- Style-layer work (composition graders, page-level examples) is unblocked
- Generated JSX is idiomatic enough to paste into a React app with `@cloudflare/kumo` and render

---

## Acceptance Criteria

### Feature: UITree to JSX Converter

- [ ] `uiTreeToJsx(tree)` returns valid JSX string with `@cloudflare/kumo` import
- [ ] Compound components use dot notation (`<Table.Header>` not `<TableHeader>`)
- [ ] Import statement includes only used components (deduplicated, sorted)
- [ ] Internal-only props (`action`, `visible`, `parentKey`, `key`) are excluded
- [ ] 8-pass normalization is applied before conversion (matches UITreeRenderer behavior)
- [ ] Empty/missing trees return an empty component gracefully
- [ ] Unit tests cover: simple tree, compound components, empty tree, text children, prop serialization

### Feature: Playground Page

- [ ] `/playground?key=<valid>` loads full-width playground
- [ ] `/playground` without valid key shows "Access restricted" message
- [ ] 4 tabs exist: Preview, Code, Grading, System Prompt
- [ ] Preview tab: `UITreeRenderer` renders live during streaming, full-width, scrollable
- [ ] Code tab: `uiTreeToJsx()` output updates live during streaming, Copy button works
- [ ] Grading tab: `gradeTree()` results update during streaming (debounced), show score + per-rule breakdown
- [ ] System Prompt tab: shows assembled prompt text (fetched once on load)
- [ ] Tab selection persists across generations
- [ ] Preset prompts available (5 existing + 3 page-level: DNS management, tunnel config, WAF overview)

### Feature: Multi-Turn Conversation

- [ ] After first generation, follow-up input appears at bottom
- [ ] Follow-up prompt sends full message history to `/api/chat`
- [ ] Tree resets on each new generation (full rebuild, not incremental)
- [ ] Conversation context enables meaningful refinement (model receives history)

### Feature: Model Selector

- [ ] Dropdown shows 3 models with friendly names
- [ ] Switching model applies to next generation
- [ ] Model override only works with valid playground auth

### Feature: `/api/chat` Extensions

- [ ] Accepts `{ message }` (backward compatible, existing behavior)
- [ ] Accepts `{ messages: [{role, content}] }` when playground-authed
- [ ] Accepts `model` override when playground-authed
- [ ] `X-Playground-Key` header validation against `PLAYGROUND_SECRET` env var
- [ ] Rate limit relaxed for playground-authed requests
- [ ] GET `/api/chat/prompt` returns system prompt text (playground-auth required)
- [ ] Existing `/streaming` demo works with zero changes

### Feature: Navigation

- [ ] "Playground" in sidebar nav
- [ ] "Playground" in search results
- [ ] `/streaming` page has visible cross-link to `/playground`

---

## Technical Context

### Existing Patterns

- **Streaming pipeline:** `createJsonlParser().push(token)` -> `RFC6902 patches` -> `useUITree().applyPatches()` -> `UITreeRenderer` — in `packages/kumo/src/streaming/` and `packages/kumo/src/generative/`
- **SSE streaming:** `readSSEStream()` in `_StreamingDemo.tsx` (lines 109-252) handles Workers AI and OpenAI-compatible SSE formats
- **Structural grading:** `gradeTree(tree)` in `packages/kumo/src/generative/structural-graders.ts` — 8 deterministic rules returning `GradeReport`
- **Component manifest:** `packages/kumo/src/generative/component-manifest.ts` — `SUB_COMPONENT_ALIASES` maps flat names to dot notation (e.g., `TableHeader` -> `Table.Header`)
- **System prompt assembly:** `createKumoCatalog().generatePrompt()` in `packages/kumo/src/catalog/` — builds full prompt with component docs, design rules, examples
- **Astro page pattern:** `.astro` pages in `src/pages/`, React islands with `client:load`, layouts in `src/layouts/`
- **Demo component pattern:** `_StreamingDemo.tsx` in `src/components/demos/` — prefixed with `_` for client-only components

### Key Files

- `packages/kumo/src/generative/ui-tree-renderer.tsx` — Renderer with 8 normalization passes (new converter must apply same normalizations)
- `packages/kumo/src/generative/structural-graders.ts` — Grading rules to surface in playground
- `packages/kumo/src/generative/component-manifest.ts` — `SUB_COMPONENT_ALIASES` for JSX dot notation mapping
- `packages/kumo/src/catalog/system-prompt.ts` — `buildSystemPrompt()` for prompt tab content
- `packages/kumo/src/catalog/types.ts` — `UITree`, `UIElement` type definitions
- `packages/kumo-docs-astro/src/pages/api/chat.ts` — SSE streaming endpoint to extend
- `packages/kumo-docs-astro/src/components/demos/_StreamingDemo.tsx` — Existing demo to extract `readSSEStream` from
- `packages/kumo-docs-astro/src/layouts/BaseLayout.astro` — Full-width layout (no sidebar)
- `packages/kumo-docs-astro/src/components/SidebarNav.tsx` — Nav entries to update
- `packages/kumo-docs-astro/src/components/SearchDialog.tsx` — Search entries to update
- `packages/kumo-docs-astro/wrangler.jsonc` — Rate limit binding, will need `PLAYGROUND_SECRET` docs

### System Dependencies

- **Workers AI:** Models `@cf/zai-org/glm-4.7-flash`, `@cf/meta/llama-4-scout-17b-16e-instruct`, `@cf/google/gemma-3-27b-it`
- **AI Gateway:** `kumo-docs` gateway for production routing
- **Cloudflare Workers:** SSR for `/api/*` routes, static for pages
- **`@cloudflare/kumo`:** All streaming/generative/catalog modules (local workspace dependency)

### Data Model Changes

None. All state is client-side (React state for messages, tree, tab selection). No database, no KV, no D1.

---

## Risks & Mitigations

| Risk                                                                            | Likelihood | Impact | Mitigation                                                                                                              |
| ------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `uiTreeToJsx` output diverges from rendered UI due to normalization differences | Med        | High   | Apply identical 8-pass normalization pipeline before JSX conversion; snapshot tests comparing tree structure vs JSX AST |
| Multi-turn conversation degrades model output quality                           | Med        | Med    | Each turn rebuilds full tree from scratch (no incremental patching); degrade gracefully to single-shot if needed        |
| Shared secret in query param leaks via browser history/referrer                 | Low        | Med    | Acceptable for internal dev tool; document risk; migrate to CF Access in v2 if needed                                   |
| Grading recomputation during streaming causes UI jank                           | Med        | Low    | Debounce grading to max every 500ms during stream; final computation on stream complete                                 |
| Code output too verbose for complex trees (30+ elements)                        | Low        | Low    | Scroll support; monospace at 12px; future: collapsible JSX sections                                                     |
| `/api/chat` backward compatibility regression                                   | Low        | High   | Accept both `message` and `messages` formats; playground features gated behind auth header; test both paths             |
| Workers AI model availability changes                                           | Low        | Low    | Hardcoded allowlist; graceful fallback to default model if selected model unavailable                                   |

---

## Alternatives Considered

### Alternative 1: Split-pane layout (Preview left, Code right)

- **Description:** Side-by-side view with preview on left (~60%) and code on right (~40%)
- **Pros:** See code and preview simultaneously; common IDE pattern
- **Cons:** Halves viewport width for preview, defeating the "full-width for page-level UI" goal; more complex layout; code panel competes with preview for attention
- **Decision:** Rejected. Tabs give full viewport to each view. Page-level UI evaluation is the primary use case and needs maximum width.

### Alternative 2: Editable system prompt

- **Description:** Allow users to modify the system prompt and see how it changes output
- **Pros:** Maximum experimentation flexibility; enables prompt engineering iteration
- **Cons:** Security risk (prompt injection via shared URLs); cost amplification (users could craft expensive prompts); requires additional API changes to accept custom prompts
- **Decision:** Rejected for v1. Read-only view provides transparency without risk. Editable prompt can be added behind additional auth in v2.

### Alternative 3: No authentication (public playground)

- **Description:** Make `/playground` publicly accessible like `/streaming`
- **Pros:** Zero auth infrastructure needed; easier onboarding
- **Cons:** Model selector enables cost amplification; playground is a dev tool, not a public demo; rate limiting alone insufficient for conversational usage patterns
- **Decision:** Rejected. Simple shared secret is minimal overhead and appropriate for internal dev tool. The existing `/streaming` demo remains public.

### Alternative 4: Server-side conversation persistence (D1/KV)

- **Description:** Store conversation threads server-side for cross-session persistence
- **Pros:** Resume conversations; share threads; analytics on usage patterns
- **Cons:** Requires D1 or KV setup; more complex API; data retention concerns; unnecessary for the core use case (iterate on quality, not save conversations)
- **Decision:** Rejected. Client-side state is sufficient. Conversations are ephemeral — the goal is quality iteration, not persistence.

---

## Non-Goals (v1)

- **Editable system prompt** — read-only view avoids prompt injection and cost risks
- **Syntax highlighting** — plain monospace `<pre>` is sufficient; Shiki/Prism deferred to v2
- **Custom component support** — playground uses built-in catalog only
- **Saving/sharing generated UIs** — no URL persistence, no export
- **Resizable panes** — tabs eliminate the need
- **Cloudflare Containers/Sandboxes** — render directly in page (same as existing demo)
- **Dynamic model discovery** — hardcoded allowlist of 3 models; no Workers AI API enumeration
- **Server-side UITree rendering** — all client-side
- **Action/event log panel** — focus on code + grading instead (action log stays on `/streaming`)
- **AI prompt engineering / output quality** — that's the style-layer plan, not this one
- **Mobile responsiveness** — dev tool, desktop-only is acceptable

---

## Interface Specifications

### API: `/api/chat` (POST, extended)

```
POST /api/chat
Headers:
  X-Playground-Key: <secret>  (optional, enables playground features)

Request (backward compatible):
  { message: string }

Request (playground mode, requires valid X-Playground-Key):
  {
    message: string,
    history?: Array<{ role: "user" | "assistant", content: string }>,
    model?: string  // e.g. "@cf/meta/llama-4-scout-17b-16e-instruct"
  }

Response: SSE stream (text/event-stream)
  data: {"response":"<token>"}\n\n
  ...
  data: [DONE]\n\n

Errors:
  400: Invalid request body / message too long
  403: Invalid playground key (when X-Playground-Key present but wrong)
  429: Rate limit exceeded (20/min unauthenticated, 100/min playground-authed)
  500: Workers AI error
  503: Service unavailable (rate limiter binding failure in production)
```

### API: `/api/chat/prompt` (GET, new)

```
GET /api/chat/prompt
Headers:
  X-Playground-Key: <secret>  (required)

Response:
  200: { prompt: string }  // Full assembled system prompt text
  403: Invalid or missing playground key
```

### UI: Playground Component States

| State                    | Top Bar                                       | Tab Content                                  | Bottom Bar                      |
| ------------------------ | --------------------------------------------- | -------------------------------------------- | ------------------------------- |
| **Unauthenticated**      | Disabled inputs                               | "Access restricted" message                  | Hidden                          |
| **Idle (no generation)** | Active: prompt input, model selector, presets | Empty state: "Enter a prompt to generate UI" | Hidden                          |
| **Streaming**            | Disabled (prevent double-submit)              | Live-updating content per active tab         | Disabled, shows "Generating..." |
| **Complete**             | Active                                        | Final content per active tab                 | Active: follow-up input         |
| **Error**                | Active (retry available)                      | Error banner with message                    | Active                          |

---

## Documentation Requirements

- [ ] Playground linked from `/streaming` page (cross-link callout)
- [ ] `uiTreeToJsx()` JSDoc with usage example
- [ ] `PLAYGROUND_SECRET` setup instructions in code comments (dev: `.dev.vars`, prod: `wrangler secret put`)
- [ ] No external documentation updates needed (internal dev tool)

---

## Open Questions

| Question | Owner | Due Date | Status |
| -------- | ----- | -------- | ------ |
| None     | —     | —        | —      |

---

## Appendix

### Glossary

- **UITree:** Flat key-addressed tree structure `{ root: string, elements: Record<string, UIElement> }` representing generated UI
- **JSONL:** JSON Lines format — one JSON object per line, used for streaming RFC 6902 patches
- **RFC 6902:** JSON Patch standard — operations: add, replace, remove on JSON Pointer paths
- **Normalization passes:** 8 deterministic transforms that fix common LLM output issues (nested surfaces, duplicate labels, etc.)
- **Structural graders:** 8 deterministic quality rules checking valid types, props, layout, a11y, depth, orphans, etc.
- **NS templates:** Network Services team's page-level Kumo templates (ProductOverview, ServiceDetail, etc.) in `inspo/` directory

### References

- Spec: `specs/streaming-playground.md`
- Existing demo: `packages/kumo-docs-astro/src/components/demos/_StreamingDemo.tsx`
- Streaming pipeline: `packages/kumo/src/streaming/`
- Generative module: `packages/kumo/src/generative/`
- Catalog/prompt: `packages/kumo/src/catalog/`
- NS templates (inspiration): `inspo/ns-kumo-ui-templates/app/components/templates/`
