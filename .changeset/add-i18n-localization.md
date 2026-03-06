---
"@cloudflare/kumo": minor
---

Add built-in i18n/localization system with 12 locale bundles, RTL logical CSS, and type-safe translations

- `useLocalize()` hook for type-safe term lookup, date/number formatting
- `KumoLocaleProvider` for subtree locale overrides
- `DirectionProvider` and `useDirection()` for RTL support
- `registerTranslation()` for custom locales
- 12 built-in locale bundles: en, ar, de, es, fr, he, it, ja, ko, pt, zh-CN, zh-TW
- Migrates key user-facing UI strings to localized `term()` calls while preserving documented overrides
- English remains the per-key fallback for untranslated locale terms
- Physical CSS properties converted to logical equivalents for RTL
- Existing `labels` props preserved as overrides
