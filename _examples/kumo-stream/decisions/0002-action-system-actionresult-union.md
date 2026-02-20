# 0002: Action system uses ActionEvent + handler registry + ActionResult union

Status: accepted
Date: 2026-02-20

## Context

Generated UI must be interactive. The LLM can declare intent ("increment", "submit_form"), but the host must execute side effects safely and predictably.

Spec background: `_examples/GENERATIVE-UI.md` (Action System).

## Decision

- Elements may include `action: { name, params? }`.
- Renderer emits `ActionEvent` with:
  - `params`: static metadata declared by the LLM
  - `context`: runtime state collected from component interaction (e.g. `{ value, checked }`)
- Host routes events through a handler registry (`Record<actionName, handler>`).
- Handlers return a typed `ActionResult` discriminated union:
  - `patch` (mutate UITree via RFC6902)
  - `message` (send text)
  - `external` (open URL)
  - `none`

## Consequences

- Handlers stay pure/testable; side effects are centralized in `processActionResult`.
- Cross-boundary hosts can observe actions via `CustomEvent('kumo-action')`.
- Form submission semantics depend on reliable runtime value capture.

## Alternatives considered

- Let handlers directly mutate DOM/state: hard to test; duplicates across hosts.
- Make LLM include user-entered values in params: incorrect and brittle.
