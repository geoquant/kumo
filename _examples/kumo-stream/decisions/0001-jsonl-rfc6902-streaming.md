# 0001: JSONL + RFC6902 streaming as the wire format

Status: accepted
Date: 2026-02-20

## Context

Streaming a single monolithic JSON UITree forces partial-JSON recovery (brace counting) and delays rendering until the final `}`. The demo goal is progressive paint.

Spec background: `_examples/kumo-stream/specs/streaming-patches.md`.

## Decision

- The model emits newline-delimited JSON (JSONL), one RFC6902 operation per line.
- The client parses complete lines and applies patches incrementally to a `UITree`.
- Supported ops are a minimal subset: `add`, `replace`, `remove`.

## Consequences

- Progressive UI is natural: each complete line is independently parseable.
- Parsers can safely skip garbage lines (markdown fences, preamble) without crashing.
- Patch semantics become the contract; array support and path security need explicit limits.

## Alternatives considered

- Monolithic JSON + brace counting: brittle and delays rendering.
- Custom patch format: reinvents RFC semantics and complicates interop.
