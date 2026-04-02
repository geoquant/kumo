# Cloudflare icons

This directory is the Kumo-owned source of truth for `CloudflareIcon` glyph assets.

## Layout

- `assets/` — committed repo-owned SVG source files
- `generated/sprite.svg` — generated SVG sprite built from `assets/`
- `generated/names.ts` — generated typed glyph-name metadata built from `assets/`

## Regeneration

```bash
pnpm --filter @cloudflare/kumo codegen:icons
```

## Validation

```bash
pnpm --filter @cloudflare/kumo lint:icons
```

This validator is warning-only. It helps catch asset-shape drift before regeneration, including:
- unexpected filename normalization
- missing or non-`0 0 16 16` `viewBox`
- stray `width` / `height` attributes
- empty SVG bodies
- disallowed script / inline event handler markup

The generation path is intentionally repo-local and does **not** depend on any committed Figma fetch script.
If glyphs originate from another internal source, that ingestion/prep should happen out-of-repo before the final SVGs are committed into `assets/`.

## Naming convention

Committed asset filenames are the glyph source of truth and preserve the upstream Figma naming semantics while normalizing formatting for the repo:

- lowercase / kebab-case filenames
- preserve meaningful prefixes such as `cloudflare-`
- preserve `-outline` / `-solid` suffixes
- do not rename icon concepts during normalization

The icon generator also fails loudly if two committed assets normalize to the same glyph name.
