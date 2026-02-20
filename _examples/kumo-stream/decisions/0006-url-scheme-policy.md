# 0006: URL scheme policy is allowlist by default

Status: accepted
Date: 2026-02-20

## Context

kumo-stream supports `navigate` actions and Link `href`s that can cross the host boundary. In cross-boundary embedding, the safest default is to avoid surprising protocol handlers and scriptable URLs.

## Decision

- Default allowlist: `http:`, `https:`, and relative URLs.
- Default blocklist (minimum): `javascript:`, `data:`, `file:`.
- `mailto:` and `tel:` are not allowed by default; hosts can opt in explicitly via their `openExternal` callback and advertised capabilities.

## Consequences

- Safe-by-default for third-party embedding.
- Some common UX links require explicit host opt-in.

## Alternatives considered

- Allow `mailto:`/`tel:` by default: convenient but less predictable across hosts.
