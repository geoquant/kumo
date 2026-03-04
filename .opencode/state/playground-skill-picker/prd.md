# Playground Panel B Skill Picker

**Type:** Feature Plan
**Effort:** M (1-3 hours)
**Status:** Ready for implementation
**Branch:** `geoquant/streaming-ui` — **CRITICAL: All work MUST stay on this branch. Do NOT create new branches, switch branches, or merge. This is a long-running experimental branch.**

## Problem

The playground A/B comparison currently shows Panel A (full system prompt) vs Panel B (bare baseline prompt). There's no way to see the visual impact of individual skills on generated UI. Users want to toggle skills on Panel B, regenerate, and compare against Panel A's output — isolating exactly what skills contribute.

## Discovery

### Key Files

| File                                       | Role                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `src/components/demos/_PlaygroundPage.tsx` | Main playground (~1973 lines). All panel rendering, streaming, state.          |
| `src/pages/api/chat/index.ts`              | POST endpoint. Handles `skipSystemPrompt`, `skillIds`, `systemPromptOverride`. |
| `src/pages/api/chat/skills.ts`             | GET endpoint. Returns `SKILL_META` (id, name, description). Already exists.    |
| `src/lib/skills-data.generated.ts`         | Auto-generated. Exports `SKILLS`, `SKILL_META`, `getSkillContents()`.          |
| `src/lib/playground.ts`                    | System prompt generation. Not modified by this feature.                        |

### Key Findings

1. **Skills API fully wired**: `/api/chat/skills` endpoint exists, `skillIds` accepted in request body, `getSkillContents()` handles injection server-side.
2. **API gap**: When `skipSystemPrompt: true` (Panel B's mode), the API ignores `skillIds` entirely — skill injection only runs in the `else` branch (`index.ts:282-309`). Must extend the `skipSystemPrompt` branch.
3. **PanelHeader component**: Currently renders only a letter label ("B") + tab bar. No toolbar area for additional UI. Must be extended.
4. **Panel B state**: Uses separate state vars (`noPromptTree`, `noPromptStatus`, `noPromptRawJsonl`, etc.) — clean separation from Panel A.

## Design Decisions

### D1: Server-side skill injection for Panel B

**Decision**: Extend the API's `skipSystemPrompt` branch to also inject `skillIds` into the override prompt.

**Why not client-side**: Full skill content is large (16 skills, each thousands of chars). Shipping it to the client for string concatenation is wasteful — the server already has `getSkillContents()`. The API already parses and validates `skillIds`. Keep the prompt assembly server-side.

**Change**: In `index.ts` line 282-289, when `skipSystemPrompt` is true and `systemPromptOverride` exists, also check for `skillIds` and append skill content to the override string.

### D2: Skill picker in Panel B header

**Decision**: Add a dropdown/popover to the Panel B header row (next to the "B" label). Contains checkboxes for each skill + an "Apply" button.

**Why not chat sidebar**: Skills only affect Panel B. Placing it there makes the association clear and avoids cluttering the shared sidebar.

### D3: Re-run semantics

**Decision**: When user clicks "Apply", re-fire ONLY Panel B's stream using the last submitted user message + newly selected skills. Panel A stays frozen. Panel B's conversation history resets.

**Why reset history**: The previous Panel B output was generated without skills; carrying that stale context into a skill-augmented generation produces incoherent multi-turn conversations.

## Deliverables

### [D1] API: Skill injection for `skipSystemPrompt` mode (S)

**File**: `src/pages/api/chat/index.ts`

**Change**: Lines 282-289. After pushing the `systemPromptOverride` as the system message, also check `chatRequest.skillIds` and append skill content.

```typescript
if (chatRequest.skipSystemPrompt) {
  let overrideContent = chatRequest.systemPromptOverride ?? "";

  // Inject skills even in skip mode (for Panel B skill comparison).
  if (chatRequest.skillIds && chatRequest.skillIds.length > 0) {
    const skillContent = getSkillContents(chatRequest.skillIds);
    if (skillContent) {
      overrideContent += `\n\n# Additional Design Skills\n\nThe following design skills should heavily influence your output. Apply their principles when generating UI:\n\n${skillContent}`;
    }
  }

  if (overrideContent) {
    messages.push({ role: "system", content: overrideContent });
  }
}
```

**Acceptance criteria**:

- `POST /api/chat` with `skipSystemPrompt: true`, `systemPromptOverride: "..."`, and `skillIds: ["taste-skill"]` produces a system message containing both the override text and the skill content.
- Without `skillIds`, behavior is unchanged (just the override or nothing).

**Depends on**: nothing

---

### [D2] Client state: Skill data fetching + selection state (S)

**File**: `src/components/demos/_PlaygroundPage.tsx`

**New state** inside `PlaygroundContent`:

```typescript
// Skill metadata fetched from /api/chat/skills
const [skills, setSkills] = useState<
  ReadonlyArray<{ id: string; name: string; description: string }>
>([]);
// Currently checked skill IDs (uncommitted — user is still picking)
const [pendingSkillIds, setPendingSkillIds] = useState<ReadonlySet<string>>(
  new Set(),
);
// Committed skill IDs (applied to the last Panel B generation)
const [appliedSkillIds, setAppliedSkillIds] = useState<ReadonlySet<string>>(
  new Set(),
);
```

**Fetch on mount**:

```typescript
useEffect(() => {
  fetch("/api/chat/skills")
    .then((r) => r.json())
    .then((data) => setSkills(data.skills))
    .catch(() => {}); // non-critical
}, []);
```

**Acceptance criteria**:

- Skills are fetched once on mount.
- `pendingSkillIds` tracks checkbox state. `appliedSkillIds` tracks what's actually been sent.
- Toggling a checkbox doesn't trigger re-generation (that's the "Apply" button).

**Depends on**: nothing

---

### [D3] Client UI: Skill picker dropdown in Panel B header (M)

**File**: `src/components/demos/_PlaygroundPage.tsx`

**Approach**: Extend the `PanelHeader` component (or the Panel B call site) to accept optional extra content in the header row. Add a `Popover` (from kumo library) containing:

1. A trigger button (e.g., "Skills" or a filter icon) next to the "B" label.
2. A popover body with:
   - Scrollable list of skill checkboxes (`Checkbox` from kumo). Each shows `skill.name`.
   - Tooltip or secondary text showing `skill.description`.
   - "Apply" button at the bottom that commits the selection.
3. Badge/count indicator showing how many skills are selected.

**PanelHeader extension** — add optional `actions` slot:

```typescript
function PanelHeader({
  label,
  tabs,
  activeTab,
  onTabChange,
  actions, // NEW: optional ReactNode rendered in the header row
}: {
  readonly label: string;
  readonly tabs: TabsItem[];
  readonly activeTab: PanelTab;
  readonly onTabChange: (value: string) => void;
  readonly actions?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 bg-kumo-elevated/50">
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-kumo-subtle">
          {label}
        </span>
        {actions}
      </div>
      {/* tabs unchanged */}
    </div>
  );
}
```

**Skill picker component** (inline or extracted):

```tsx
function SkillPicker({
  skills,
  pendingIds,
  onToggle,
  onApply,
  isStreaming,
}: {
  readonly skills: ReadonlyArray<{
    id: string;
    name: string;
    description: string;
  }>;
  readonly pendingIds: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onApply: () => void;
  readonly isStreaming: boolean;
}) {
  // Popover with checkbox list + Apply button
}
```

**Acceptance criteria**:

- Dropdown appears in Panel B header only (Panel A header unchanged).
- Each skill has a checkbox with its name.
- Multiple skills can be selected simultaneously.
- "Apply" button is present and clearly labeled.
- "Apply" is disabled while Panel B is streaming.
- Dropdown closes after Apply is clicked.
- Panel A header is untouched — no `actions` prop passed.

**Depends on**: D2

---

### [D4] Client logic: Re-run Panel B on skill apply (M)

**File**: `src/components/demos/_PlaygroundPage.tsx`

**Behavior when "Apply" is clicked**:

1. Commit: `setAppliedSkillIds(new Set(pendingSkillIds))`
2. Abort any in-flight Panel B stream (`noPromptAbortRef.current?.abort()`)
3. Reset Panel B state: `noPromptReset()`, clear `noPromptRawJsonl`, reset `noPromptStatus`, clear right action log.
4. Do NOT touch Panel A state.
5. Re-fire ONLY the Panel B fetch using the last submitted user message (need to store it).
6. Include `skillIds: [...appliedSkillIds]` in the request body alongside `skipSystemPrompt: true` and `systemPromptOverride: BASELINE_PROMPT`.

**New state**: Store the last submitted message for replay.

```typescript
const lastMessageRef = useRef<string | null>(null);
// Set in handleSubmit: lastMessageRef.current = trimmedMessage;
```

**Extract Panel B streaming into a reusable function** (`streamPanelB`):

```typescript
const streamPanelB = useCallback(
  async (message: string, skillIds: string[]) => {
    // Abort existing Panel B stream
    noPromptAbortRef.current?.abort();

    // Reset Panel B state
    noPromptReset();
    setNoPromptRawJsonl("");
    noPromptRawJsonlRef.current = "";
    setNoPromptStatus("streaming");
    setRightActionLog([]);

    const runId = /* use existing runIdRef pattern or new one for B */;
    const parser = createJsonlParser();
    const controller = new AbortController();
    noPromptAbortRef.current = controller;

    // Build body — reuse model, no history (reset)
    const body = {
      message,
      model: selectedModel,
      skipSystemPrompt: true,
      systemPromptOverride: BASELINE_PROMPT,
      ...(skillIds.length > 0 ? { skillIds } : {}),
    };

    // Same streaming logic as current Stream 2 block
    // ...
  },
  [selectedModel, /* deps */],
);
```

**handleSubmit modification**: Extract Stream 2 logic into `streamPanelB`, call it from both `handleSubmit` (initial generation) and the Apply handler.

**Apply handler**:

```typescript
const handleApplySkills = useCallback(() => {
  const newApplied = new Set(pendingSkillIds);
  setAppliedSkillIds(newApplied);

  const lastMessage = lastMessageRef.current;
  if (!lastMessage) return; // Nothing to re-run

  streamPanelB(lastMessage, [...newApplied]);
}, [pendingSkillIds, streamPanelB]);
```

**Acceptance criteria**:

- Clicking "Apply" with skills selected re-generates Panel B output.
- Panel A output is unchanged.
- Panel B's history is reset (fresh generation).
- The same user prompt is re-used (not requiring re-type).
- If no message has been sent yet, "Apply" is a no-op (or disabled).
- Changing skills and applying again replaces Panel B output each time.
- Selecting zero skills and applying re-runs with just the baseline prompt.

**Depends on**: D1, D2, D3

---

## Risks

| Risk                                                                                | Impact                                              | Mitigation                                                                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Large skill content inflates system prompt beyond model context window              | Panel B generation fails or truncates               | The API already caps at 5 skills. Monitor total token count. Could add a warning in the UI if many skills are selected. |
| Extracting Stream 2 logic into `streamPanelB` may break `runIdRef` staleness guards | Race conditions between Panel A and Panel B streams | Use a separate `panelBRunIdRef` counter for Panel B staleness checks, independent of the shared `runIdRef`.             |

## Non-Goals

- Skill picker for Panel A (Panel A uses the full system prompt, always).
- Persisting skill selection across page reloads.
- Editing or creating skills from the playground UI.
- Client-side skill content display (skills are injected server-side; the UI only shows names).

## Open Questions

None — all resolved during clarification.
