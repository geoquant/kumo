# 0007: DPU mode v1 is root snapshot replacement

Status: accepted
Date: 2026-02-20

## Context

WICG Declarative Partial Updates (DPU) enables progressive/no-JS DOM updates via streamed `<template for="...">` patches that target marker ranges.

Implementing fine-grained per-element markers requires stable marker naming, mapping UI tree keys to ranges, and a server-side incremental HTML strategy.

## Decision

- DPU mode is experimental and feature-gated.
- v1 DPU uses a single marker range (e.g. `kumo-ui`) and streams full HTML snapshots via:
  - initial shell: `<?start name="kumo-ui">Loading...<?end name="kumo-ui">`
  - updates: `<template for="kumo-ui">...rendered HTML...</template>`
- Per-element markers are deferred.

## Consequences

- Fast path to "content without JS" with minimal new semantics.
- Higher bandwidth than fine-grained patches; focus preservation is a future concern.

## Alternatives considered

- Per-element markers v1: higher complexity and more failure modes in a reference impl.
