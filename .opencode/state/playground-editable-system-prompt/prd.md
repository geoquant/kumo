# Playground: Editable System Prompt

**Type:** Feature plan
**Effort:** L (1-2 days)
**Status:** Draft
**Branch:** `geoquant/streaming-ui` (CRITICAL: all work MUST stay on this branch)

## Problem

External collaborators can iterate on the user prompt in the playground but not the system prompt. The system prompt is generated server-side from the Kumo catalog and served read-only. Even internal contributors with repo access can't iterate on it without being in the org that owns the Workers AI binding. This blocks prompt engineering collaboration.

## Constraints

- **Branch: `geoquant/streaming-ui`** — ALL implementation work MUST happen on this branch. Do NOT create new branches, do NOT switch branches. Every commit lands here.
- Panel B must remain the fixed control (baseline prompt, untouched)
- No auth required; anyone with the playground URL can use this
- System prompt is large (~thousands of tokens); editing must be ergonomic
- Existing verifier, eval, and feedback systems must continue working
- Backend already accepts `skipSystemPrompt` + `systemPromptOverride` on `POST /api/chat`
- Rate limiting (100 req/min/IP) still applies
- `MAX_SYSTEM_PROMPT_OVERRIDE_LENGTH` is 50,000 chars (sufficient for full prompt)

## Non-Goals

- Persisting prompt edits server-side (no database)
- Collaborator accounts or permissions
- Editing the Panel B baseline prompt
- Modifying the prompt generation pipeline itself (`playground.ts`, catalog system)
- Multi-turn conversation for AI prompt editing (single-turn only)
- Separate worker deployment for AI editing (reuses existing `/api/chat`)

## Solution

### Architecture

Convert Panel A's read-only "Prompt" tab into an editable view. When the prompt is modified and the user hits "Regenerate", Panel A re-runs using the edited prompt via the existing `skipSystemPrompt` + `systemPromptOverride` API path. Panel B is unaffected.

```
                          ┌──────────────────────┐
                          │   Prompt tab (Panel A)│
                          │  ┌──────────────────┐ │
                          │  │ Editable textarea │ │
 GET /api/chat/prompt ──► │  │ (pre-filled with  │ │
 (on mount, as today)     │  │  canonical prompt) │ │
                          │  └──────────────────┘ │
                          │  [Reset] [Regenerate]  │
                          └──────────┬─────────────┘
                                     │ user clicks Regenerate
                                     ▼
                          POST /api/chat
                          {
                            message: <last user message>,
                            skipSystemPrompt: true,
                            systemPromptOverride: <edited prompt>
                          }
                                     │
                          ┌──────────▼─────────────┐
                          │  Panel A re-renders     │
                          │  (replaces previous)    │
                          └────────────────────────┘
                          Panel B: unchanged (still using BASELINE_PROMPT)
```

### AI-Assisted Prompt Editing

In addition to manual editing, users can ask an AI to modify the system prompt. A chat-style input within the Prompt tab accepts natural-language instructions (e.g. "make the component descriptions more concise", "add emphasis on accessibility props"). The AI returns a complete modified prompt that directly replaces the textarea content.

#### Why not a separate worker?

A separate worker would add deployment complexity, a new API surface, CORS configuration, and a second rate limiter — all for something that is fundamentally the same operation: send messages to Workers AI, stream back text. The existing `POST /api/chat` endpoint already supports `skipSystemPrompt` + `systemPromptOverride` and streams via SSE. We reuse it with a dedicated system prompt for "prompt editing" mode.

#### Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Prompt tab (Panel A)                                        │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Editable textarea (system prompt)                      │ │
│  │ ...                                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ "Describe changes..."  [input]              [Send ▶]   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Token count: ~4,200 tokens (estimate)   [Regenerate]       │
└─────────────────────────────────────────────────────────────┘
```

1. User types instruction in the AI input (e.g. "remove all chart-related components")
2. Frontend calls `POST /api/chat` with:
   - `skipSystemPrompt: true`
   - `systemPromptOverride`: a meta-prompt (see below) that instructs the AI to edit prompts
   - `message`: includes the current system prompt text + the user's editing instruction + optional output context
3. AI streams back the full modified prompt as plain text (NOT JSONL — see streaming section)
4. On stream complete, the response directly replaces the textarea content
5. User can then manually tweak further, or hit "Regenerate" to test it

#### Meta-Prompt for Prompt Editing

The AI that edits the system prompt needs its own system prompt. This is a static string, not generated from the catalog:

```
PROMPT_EDITOR_SYSTEM_PROMPT = `You are a prompt engineering assistant.
You will receive a system prompt and an instruction to modify it.
Return ONLY the complete modified system prompt — no explanations,
no markdown fences, no preamble. Your output replaces the original
prompt verbatim.

Rules:
- Preserve the overall structure and formatting of the original prompt
- Make only the changes requested by the user
- If the user asks for something that would break the prompt's
  function (e.g. removing all component definitions), do it anyway —
  the user is experimenting
- Do not add commentary before or after the prompt`
```

#### User Message Construction

```typescript
function buildPromptEditMessage(opts: {
  currentPrompt: string;
  instruction: string;
  outputContext?: {
    gradingReport?: string; // from gradeTree + gradeComposition
    elementCount?: number;
    treeDepth?: number;
    lastUserPrompt?: string; // what the user asked the playground to generate
  };
}): string {
  const parts: string[] = [
    "<current-system-prompt>",
    opts.currentPrompt,
    "</current-system-prompt>",
    "",
    "<instruction>",
    opts.instruction,
    "</instruction>",
  ];

  if (opts.outputContext) {
    parts.push("", "<output-context>");
    if (opts.outputContext.lastUserPrompt) {
      parts.push(`Last user prompt: ${opts.outputContext.lastUserPrompt}`);
    }
    if (opts.outputContext.elementCount !== undefined) {
      parts.push(`Generated element count: ${opts.outputContext.elementCount}`);
    }
    if (opts.outputContext.treeDepth !== undefined) {
      parts.push(`Generated tree depth: ${opts.outputContext.treeDepth}`);
    }
    if (opts.outputContext.gradingReport) {
      parts.push(`Grading report:\n${opts.outputContext.gradingReport}`);
    }
    parts.push("</output-context>");
  }

  return parts.join("\n");
}
```

The output context gives the AI signal about what's going wrong. If Panel A just generated a poor result, the grading scores and element stats help the AI make targeted improvements.

#### Streaming: Plain Text, Not JSONL

The existing `streamJsonlUI` helper expects SSE → JSONL → JSON Patch operations. For prompt editing we need raw text accumulation. Two options:

**Option A: New lightweight stream reader.** A thin `streamPlainText()` function that reads SSE tokens and concatenates them. ~20 lines. Doesn't touch the existing JSONL pipeline.

**Option B: Reuse `streamJsonlUI` with a passthrough.** Abuse the `onToken` callback to accumulate text and ignore `onPatches`. Fragile — couples to JSONL parser internals.

**Choice: Option A.** Clean separation. The function:

```typescript
async function streamPlainText(opts: {
  body: Record<string, unknown>;
  signal: AbortSignal;
  onToken: (token: string) => void;
}): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(opts.body),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  let full = "";
  await readSSEStream(res, (token) => {
    full += token;
    opts.onToken(token);
  });
  return full;
}
```

This reuses the existing `readSSEStream` (which handles SSE `data:` lines and `[DONE]`) but skips the JSONL parser. The AI's response is plain text, not JSON patches.

#### Validation Budget

The current `MAX_TOTAL_MESSAGE_CHARS` is 40,000 for user+history content. The prompt editing message includes the full system prompt (~15-25K chars) + instruction + optional context. This fits within the existing 40K budget since there's no conversation history. If it becomes tight, we can either:

1. Increase `MAX_TOTAL_MESSAGE_CHARS` for prompt-edit requests (add a flag to the request)
2. Truncate the grading report context

For now, the existing budget is sufficient.

### URL State

Encode the prompt delta (not the full prompt) in the URL to keep URLs shareable:

- When prompt is unmodified: no URL param
- When prompt is modified: `?promptOverride=<lz-string compressed, base64url encoded>`
- On page load: if `promptOverride` param exists, decompress and apply as the initial prompt text
- Use `lz-string` (`lzString.compressToEncodedURIComponent` / `decompressFromEncodedURIComponent`) to keep URLs manageable

Trade-off: URL length limit is ~2,000 chars in practice. A heavily edited prompt may exceed this. Mitigations:

1. If compressed override exceeds 1,500 chars, fall back to `localStorage` and put a short hash in the URL instead: `?promptRef=<hash>`
2. Show a warning in the UI: "Prompt too large for URL sharing. Changes saved locally."
3. For most real edits (tweaking instructions, not rewriting the whole thing), compression will keep it under limit.

**Alternative considered:** Always use `localStorage` + hash in URL. Rejected because the common case (small edits) should produce a directly shareable URL without requiring both parties to have local state.

### Detailed Changes

#### D1. Prompt tab UI overhaul (`_PlaygroundPage.tsx`) [M]

**Current:** `PromptTextView` renders the prompt as read-only Markdown.

**New:** Replace with `PromptEditor` component for Panel A only. Panel B keeps the existing read-only view.

```typescript
// Panel A prompt tab
interface PromptEditorProps {
  readonly canonicalPrompt: string | null; // from GET /api/chat/prompt
  readonly editedPrompt: string | null; // user's current edits (null = unchanged)
  readonly onPromptChange: (text: string) => void;
  readonly onReset: () => void;
  readonly onRegenerate: () => void;
  readonly isStreaming: boolean;
  readonly isModified: boolean;
}
```

UI layout:

- **Header bar:** Token count estimate + "Modified" badge (when dirty) + "Reset to canonical" button
- **Body:** Plain `<textarea>` with monospace font, full height. NOT markdown-rendered (the prompt is plain text with markdown-like formatting; editing rendered markdown is a different, harder problem).
- **Footer bar:** "Regenerate with this prompt" button (disabled while streaming or prompt unchanged from last run)

**Why textarea, not CodeMirror/Monaco?** The prompt is unstructured text. A textarea with monospace font is sufficient. Adding a code editor dependency for plain text is unjustified complexity. If needed later, it's a drop-in replacement.

#### D2. State additions (`_PlaygroundPage.tsx` + `state.ts`) [S]

Add to `PlaygroundContent` local state (NOT the reducer, since this is Panel A-specific UI state):

```typescript
// In PlaygroundContent:
const [editedSystemPrompt, setEditedSystemPrompt] = useState<string | null>(
  null,
);
// null = using canonical prompt (no edits)
// string = user has modified the prompt
```

Derive `isPromptModified`:

```typescript
const isPromptModified = editedSystemPrompt !== null;
const activeSystemPrompt = editedSystemPrompt ?? systemPromptText;
```

#### D3. Regeneration logic (`_PlaygroundPage.tsx`) [S]

New `regenerateWithPrompt` callback:

```typescript
const regenerateWithPrompt = useCallback(() => {
  if (!activeSystemPrompt) return;
  const lastUserMessage = messages.filter(m => m.role === "user").at(-1);
  if (!lastUserMessage) return;

  // Re-run Panel A only, using the edited prompt as an override
  // Abort any in-flight Panel A stream
  abortRef.current?.abort();
  const runId = runIdRef.current + 1;
  runIdRef.current = runId;

  runtimeValueStore.clear();
  reset();
  resetLeftEditor("");
  setErrorMessage(null);
  setStatus("streaming");
  setRawJsonl("");
  rawJsonlRef.current = "";
  clearLeftActionLog();

  const body: Record<string, unknown> = {
    message: lastUserMessage.content,
    model: selectedModel,
    skipSystemPrompt: true,
    systemPromptOverride: activeSystemPrompt,
  };

  // ... standard stream handling (same as startWorkspaceComparison's Panel A path)
}, [activeSystemPrompt, messages, selectedModel, ...]);
```

Key: uses `skipSystemPrompt: true` + `systemPromptOverride` (same path Panel B uses). The backend already validates this combination. Panel B stream is NOT re-fired.

#### D4. URL state sync [S]

```typescript
// On mount: read from URL
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const compressed = params.get("promptOverride");
  if (compressed) {
    const decompressed = lzString.decompressFromEncodedURIComponent(compressed);
    if (decompressed) setEditedSystemPrompt(decompressed);
  }
}, []);

// On change: write to URL (debounced)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (editedSystemPrompt === null) {
    params.delete("promptOverride");
  } else {
    const compressed =
      lzString.compressToEncodedURIComponent(editedSystemPrompt);
    if (compressed.length <= 1500) {
      params.delete("promptRef");
      params.set("promptOverride", compressed);
    } else {
      // Fallback: store in localStorage, put hash in URL
      const hash = simpleHash(editedSystemPrompt);
      localStorage.setItem(`prompt-${hash}`, editedSystemPrompt);
      params.delete("promptOverride");
      params.set("promptRef", hash);
    }
  }
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
}, [editedSystemPrompt]);
```

**Dependency:** `lz-string` package (4KB gzipped, zero deps, widely used).

#### D5. Prompt tab conditional rendering [S]

In `PanelContent`, the `"prompt"` case switches on panel identity:

```typescript
case "prompt":
  if (panelId === "a") {
    return (
      <PromptEditor
        canonicalPrompt={promptText}
        editedPrompt={editedSystemPrompt}
        onPromptChange={onPromptChange}
        onReset={onPromptReset}
        onRegenerate={onRegenerate}
        isStreaming={isStreaming}
        isModified={isPromptModified}
      />
    );
  }
  return (
    <div className="p-4">
      <PromptTextView text={promptText} />
    </div>
  );
```

This requires threading `panelId`, `editedSystemPrompt`, `onPromptChange`, `onPromptReset`, and `onRegenerate` through to `PanelContent`. These get added to the existing props interface.

#### D6. Visual indicator in Panel A header [S]

When the system prompt has been modified, show a small indicator in Panel A's header (next to the "A" label):

```
┌─ A (modified prompt) ─────────────────────────────┐
```

Uses the existing `PanelHeader` component. Conditionally render a `<Badge variant="warning" size="sm">modified</Badge>` when `isPromptModified` is true.

#### D7. `streamPlainText` utility (`src/lib/stream-plain-text.ts`) [S]

New file. Thin wrapper over `readSSEStream` that accumulates raw text tokens without the JSONL parser. ~20 lines. Used exclusively by the AI prompt editor.

```typescript
export async function streamPlainText(opts: {
  readonly body: Record<string, unknown>;
  readonly signal: AbortSignal;
  readonly onToken: (token: string) => void;
}): Promise<string>;
```

#### D8. `PROMPT_EDITOR_SYSTEM_PROMPT` constant (`src/lib/tool-prompts.ts`) [S]

Add the meta-prompt for prompt editing alongside the existing `BASELINE_PROMPT` constant. Static string, ~150 words. Instructs the AI to return only the modified prompt with no preamble.

#### D9. `buildPromptEditMessage` helper (`src/lib/playground/prompt-edit.ts`) [S]

New file. Pure function that constructs the user message from current prompt + instruction + optional output context. Easily testable in isolation.

```typescript
export function buildPromptEditMessage(opts: {
  readonly currentPrompt: string;
  readonly instruction: string;
  readonly outputContext?: {
    readonly gradingReport?: string;
    readonly elementCount?: number;
    readonly treeDepth?: number;
    readonly lastUserPrompt?: string;
  };
}): string;
```

#### D10. AI prompt editor UI in `PromptEditor` component [M]

Extends the `PromptEditor` component (D1) with:

- A text input below the textarea: "Describe changes..." with a Send button
- Loading state while AI is streaming (show streaming text replacing textarea content progressively)
- Disable Send while streaming
- On completion, textarea contains the AI's full response (user can then edit manually)
- Output context is gathered automatically from current Panel A state (tree element count, depth, grading report if available)

Props additions to `PromptEditorProps`:

```typescript
interface PromptEditorProps {
  // ... existing props from D1 ...
  readonly tree: UITree; // for output context
  readonly lastUserPrompt: string | null; // last message sent to playground
  readonly gradingReport: string | null; // from gradeTree if available
  readonly selectedModel: string; // model to use for AI editing
  readonly onPromptChange: (text: string) => void; // already in D1
}
```

AI edit state is local to `PromptEditor` (not in the reducer):

```typescript
const [aiInstruction, setAiInstruction] = useState("");
const [aiStreaming, setAiStreaming] = useState(false);
const aiAbortRef = useRef<AbortController | null>(null);
```

### Impact on Existing Systems

| System            | Impact | Notes                                                                                                                                                                                                                                          |
| ----------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel B           | None   | Panel B stream path is completely separate                                                                                                                                                                                                     |
| Verifier          | Minor  | The verifier report is Panel A-only. It will run against the regenerated output. The prompt budget thresholds should still apply since we're not changing the verifier code — just the prompt fed to the LLM.                                  |
| Eval/Feedback     | None   | Eval system captures artifacts post-stream. Edited prompt changes Panel A output but capture flow is unchanged.                                                                                                                                |
| History scrubber  | Works  | Output history captures snapshots. A regeneration creates a new history entry as it would for any re-run. The `promptText` stored in history should use `activeSystemPrompt` so scrubbing back shows the prompt that was active at that point. |
| API rate limiting | Minor  | AI prompt editing uses the same `POST /api/chat` endpoint and shares the 100 req/min/IP rate limit with playground generation. Heavy prompt iteration could exhaust the budget. Acceptable trade-off — keeps architecture simple.              |
| `POST /api/chat`  | None   | No backend changes needed. AI editing uses existing `skipSystemPrompt` + `systemPromptOverride` path.                                                                                                                                          |

### Risks

1. **URL length overflow:** Heavily edited prompts won't fit in URL params even compressed. Mitigated by localStorage fallback + user-facing warning.
2. **Stale canonical prompt:** The canonical prompt is fetched once on mount and cached. If the deployed prompt changes (new Kumo version), the user's "canonical" baseline is stale until refresh. This is the existing behavior — no regression.
3. **Accidental regeneration without changes:** User might hit "Regenerate" thinking it will use the canonical prompt when they've actually made edits. Mitigated by clear "Modified" badge and requiring explicit Reset action.
4. **AI prompt quality:** The prompt-editing AI (same Workers AI models as playground) may produce mediocre edits, especially with less capable models like glm-4.7-flash. Mitigated by: (a) direct replace into editable textarea means user always reviews and can manually fix, (b) output context improves AI's targeting.
5. **Rate limit contention:** AI prompt edits share rate limit with playground generation. A user iterating rapidly on prompt edits may hit 429 when trying to regenerate. Low risk — 100 req/min is generous for manual interaction.
6. **Prompt-in-prompt injection:** The user's current system prompt is embedded in the message to the prompt-editing AI. A malicious prompt could attempt to hijack the editing AI. Low severity — the editing AI's output goes into a textarea the user controls, not into any privileged execution path.

### Open Questions

- None. All design decisions resolved.

## Implementation Notes

> **CRITICAL:** All work is on branch `geoquant/streaming-ui`. Do not create feature branches, do not switch branches. Every deliverable, every commit, every task — stays on `geoquant/streaming-ui`.

## Deliverables (Ordered)

### Phase 1: Manual Editing

1. **[D4] URL state sync + lz-string dep** (S) -- depends on: -
2. **[D2] State additions** (S) -- depends on: D4
3. **[D1] PromptEditor component** (M) -- depends on: D2
4. **[D5] Conditional prompt tab rendering** (S) -- depends on: D1
5. **[D3] Regeneration logic** (S) -- depends on: D2, D5
6. **[D6] Modified badge in Panel A header** (S) -- depends on: D2

Note: D4 and D2 can be done in a single pass. D1 is the bulk of the work (new component). D3/D5/D6 are wiring.

### Phase 2: AI-Assisted Editing

7. **[D7] `streamPlainText` utility** (S) -- depends on: -
8. **[D8] `PROMPT_EDITOR_SYSTEM_PROMPT` constant** (S) -- depends on: -
9. **[D9] `buildPromptEditMessage` helper + tests** (S) -- depends on: D8
10. **[D10] AI prompt editor UI in PromptEditor** (M) -- depends on: D1, D7, D9

Phase 2 is independent of Phase 1 at the code level (D7-D9 have no deps on D1-D6), but D10 integrates into the PromptEditor component from D1. Both phases can be developed in parallel up to the integration point.

## Acceptance Criteria

### Manual Editing

- [ ] Panel A's Prompt tab shows an editable textarea pre-filled with the canonical system prompt
- [ ] Editing the prompt and clicking "Regenerate" re-runs Panel A only with the modified prompt
- [ ] Panel B output is not affected by prompt edits or regeneration
- [ ] "Reset" button restores the canonical prompt (user can also just edit the text directly)
- [ ] Panel A header shows "modified" badge when prompt has been edited
- [ ] Edited prompt survives page reload via URL state
- [ ] Sharing the URL with `?promptOverride=...` loads the edited prompt for the recipient
- [ ] Token count estimate updates as the prompt is edited
- [ ] Regenerate button is disabled while streaming
- [ ] Fallback to localStorage when compressed prompt exceeds URL length limit

### AI-Assisted Editing

- [ ] Prompt tab has a text input ("Describe changes...") below the textarea
- [ ] Typing an instruction and hitting Send calls `POST /api/chat` with the prompt-editing meta-prompt
- [ ] AI response streams directly into the textarea, replacing its content progressively
- [ ] On completion, textarea contains the full modified prompt (user can further edit manually)
- [ ] Output context (element count, tree depth, grading report, last user prompt) is included in the AI request when available
- [ ] Send button is disabled while AI is streaming
- [ ] AI editing and manual editing compose naturally (edit by AI, then tweak by hand, then regenerate)
- [ ] AI prompt editing shares the existing rate limit (no separate worker or endpoint)
