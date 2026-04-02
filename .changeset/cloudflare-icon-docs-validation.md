---
"@cloudflare/kumo": patch
---

Add initial CloudflareIcon docs and asset validation.

- document the generated sprite-backed CloudflareIcon component and examples
- add a warning-only icon asset validator for committed SVG sources
- remove the exported sprite URL import path that broke Astro docs builds
