# 0004: submit_form collects runtime-captured field values (v1 container-scope default)

Status: accepted
Date: 2026-02-20

## Context

Today `submit_form` only serializes `event.params` or `event.context`. Most user-entered values (Input/Textarea) are not captured, so forms feel fake.

`_examples/GENERATIVE-UI.md` explicitly separates:

- `params`: static metadata from the LLM
- `context`: runtime state collected by the host

## Decision

- Introduce a runtime value-capture store keyed by `elementKey`.
- Inputs remain usable as uncontrolled components, but still publish value changes into the store.
- `submit_form` constructs its payload from:
  - `params` (static metadata)
  - captured field values (runtime)

Non-goal (v1)

- Do not rely on native DOM `<form>` submission or `FormData`.

Scoping (v1)

- Default (no `params.formKey` and no `params.fieldKeys`): collect all captured fields in the current container.
- Escape hatch:
  - `params.formKey`: collect only fields under that subtree
  - `params.fieldKeys`: collect only the listed keys

Guardrails (v1)

- Only include field-like controls: `Input`, `Textarea`/`InputArea`, `Select`, `Checkbox`, `Switch`, `Radio`.
- Default to touched-only: include fields only after the user has interacted (typed/changed) at least once.
- Ambiguity fail-closed: if more than one `submit_form` action is present in the container and no explicit scoping is provided, the host returns `none` (and should log a warning).

## Consequences

- Simple mini-apps work without extra prompting.
- Multi-form surfaces can leak unrelated fields unless scoping is used.
- Capabilities/docs must state the v1 assumption clearly.

## Alternatives considered

- Require scoping always: safer but fragile for demos.
- Add a dedicated Form component: conflicts with schema validation unless treated as host-only.
