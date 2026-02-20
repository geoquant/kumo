## Decision Records (ADR-ish)

This directory captures high-level architecture decisions for the `_examples/kumo-stream/` reference implementation.

Why: kumo-stream is intended as a reference impl of `_examples/GENERATIVE-UI.md`. Drift (docs vs code) is the main failure mode, so we record the decisions that shape behavior.

Format

- One file per decision: `NNNN-kebab-title.md`
- Keep it short: context, decision, consequences
- Link to the motivating spec/doc and (optionally) the introducing commit

Template

```
# NNNN: Title

Status: accepted | superseded | draft
Date: YYYY-MM-DD

## Context

## Decision

## Consequences

## Alternatives considered
```
