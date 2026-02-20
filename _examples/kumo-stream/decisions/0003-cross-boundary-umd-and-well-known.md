# 0003: Cross-boundary embedding via UMD + .well-known discovery

Status: accepted
Date: 2026-02-20

## Context

The core claim in `_examples/GENERATIVE-UI.md` is that any host (not just a React SPA) can render streaming Kumo UI.

## Decision

- Build a self-contained UMD bundle that exposes `window.CloudflareKumo`.
- Serve well-known endpoints:
  - `/.well-known/component-loadable.umd.js`
  - `/.well-known/stylesheet.css`
  - `/.well-known/component-registry.json`
  - `/.well-known/generative-ui.json`

## Consequences

- Plain HTML hosts can render progressive UI with only `<script>` + container element.
- The discovery document becomes the compatibility boundary; capabilities must be explicit.

## Alternatives considered

- Require host bundlers (ESM import): defeats cross-boundary embedding.
- Hardcode asset paths: breaks discovery and portability.
