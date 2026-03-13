/**
 * URL ↔ editedSystemPrompt synchronisation.
 *
 * Persists the user's edited system prompt to the URL so that playground
 * links can be shared with a custom prompt baked in.
 *
 * Strategy:
 *  - Compress via lz-string's `compressToEncodedURIComponent`.
 *  - If the compressed string ≤ 1500 chars → `?promptOverride=<compressed>`.
 *  - If it exceeds 1500 chars → store in localStorage under a content-hash
 *    key and set `?promptRef=<hash>` instead.
 *  - When the prompt is cleared (null) → remove both params.
 *
 * On mount the hook reads back from the URL (or localStorage) and calls
 * `setEditedSystemPrompt` so the state is rehydrated.
 */

import { useEffect, useRef } from "react";
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARAM_OVERRIDE = "promptOverride";
const PARAM_REF = "promptRef";
/** Max compressed length before we fall back to localStorage. */
const MAX_URL_LENGTH = 1500;
const LS_PREFIX = "kumo-prompt:";
/** Debounce delay (ms) before writing URL changes. */
const DEBOUNCE_MS = 400;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple content hash (FNV-1a 32-bit) for localStorage keys.
 * Deterministic and fast — no crypto needed for local dedup.
 */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function updateUrl(params: URLSearchParams): void {
  const qs = params.toString();
  const newUrl =
    window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  window.history.replaceState(window.history.state, "", newUrl);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Synchronises `editedSystemPrompt` with the browser URL.
 *
 * - **Mount**: reads `?promptOverride` or `?promptRef` and rehydrates state.
 * - **Update**: debounced write-back via `replaceState`.
 */
export function usePromptUrlSync(
  editedSystemPrompt: string | null,
  setEditedSystemPrompt: (value: string | null) => void,
): void {
  const mountedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Mount: rehydrate from URL ------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const override = readParam(PARAM_OVERRIDE);
    if (override !== null) {
      const decompressed = decompressFromEncodedURIComponent(override);
      if (decompressed) {
        setEditedSystemPrompt(decompressed);
        mountedRef.current = true;
        return;
      }
    }

    const ref = readParam(PARAM_REF);
    if (ref !== null) {
      try {
        const stored = localStorage.getItem(`${LS_PREFIX}${ref}`);
        if (stored !== null) {
          setEditedSystemPrompt(stored);
        }
      } catch {
        // localStorage unavailable — silently ignore.
      }
      mountedRef.current = true;
      return;
    }

    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount
  }, []);

  // --- Sync changes back to URL (debounced) --------------------------------
  useEffect(() => {
    // Skip the very first render so we don't double-write the rehydrated value.
    if (!mountedRef.current) return;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);

      if (editedSystemPrompt === null) {
        // Clear both params.
        params.delete(PARAM_OVERRIDE);
        params.delete(PARAM_REF);
        updateUrl(params);
        return;
      }

      const compressed = compressToEncodedURIComponent(editedSystemPrompt);

      if (compressed.length <= MAX_URL_LENGTH) {
        params.set(PARAM_OVERRIDE, compressed);
        params.delete(PARAM_REF);
      } else {
        // Fall back to localStorage.
        const hash = fnv1aHash(editedSystemPrompt);
        try {
          localStorage.setItem(`${LS_PREFIX}${hash}`, editedSystemPrompt);
        } catch {
          // Quota exceeded — best-effort.
        }
        params.set(PARAM_REF, hash);
        params.delete(PARAM_OVERRIDE);
      }

      updateUrl(params);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [editedSystemPrompt]);
}
