---
"@cloudflare/kumo": minor
---

Add packaged app runtime React hooks.

### New

- add `@cloudflare/kumo/app-runtime/react` with `useUIStream` and `useChatUI` for streamed AppSpec sessions
- expose runtime effect callbacks and chat/session helpers for mixed text plus UI flows

### Improved

- add mutable app store helpers for state replacement and stream status updates
- return watcher-triggered runtime effects and align loadable/jsonl tests with RFC 6902 semantics
