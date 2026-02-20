# 0005: Form submission is action-scoped, not native DOM <form>

Status: accepted
Date: 2026-02-20

## Context

In native HTML, inputs are associated with a `<form>` and submission produces a `FormData` payload automatically. kumo-stream renders a component tree and emits `ActionEvent`s; there is no implicit `<form>` boundary.

We need `submit_form` to behave like "real form submit" while staying within the ActionEvent/ActionResult model.

## Decision

- kumo-stream does not rely on native DOM form submission or `FormData`.
- Inputs and other field-like controls publish runtime values into a host-managed value-capture store keyed by `elementKey`.
- `submit_form` uses that store (plus static `params`) to construct a submission payload.

## Consequences

- Form semantics are explicit and portable across React SPA and UMD hosts.
- We must define scoping + guardrails for which fields are included.
- We can add an opt-in DOM `<form>` implementation later, but it is not the v1 contract.

## Alternatives considered

- Render a real `<form>` wrapper and use `new FormData(formEl)` at submit time.
  - More "HTML-correct", but requires a new form boundary primitive + schema/prompt work and is less portable across non-DOM hosts.
