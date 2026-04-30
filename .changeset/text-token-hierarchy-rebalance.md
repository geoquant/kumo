---
"@cloudflare/kumo": patch
"@cloudflare/kumo-docs-astro": patch
---

Rebalanced semantic text token usage to improve hierarchy and consistency across components, docs, and generated Figma output.

- Updated theme token definitions so `text-kumo-strong` represents high-emphasis text and `text-kumo-inactive` is lighter/inactive in both light and dark modes.
- Migrated affected UI surfaces from `text-kumo-strong` to `text-kumo-subtle` where content is supportive metadata, labels, or secondary text.
- Synced token usage in docs and Figma code generators with the updated semantic text mapping.
