/**
 * ActionResult processor — maps registry results to host side effects.
 *
 * Pure side-effect dispatch: takes an ActionResult discriminated union
 * and calls the appropriate host callback. Decoupled from React so it
 * can be tested independently and reused across hosts (React SPA, HTML/UMD).
 */

import type { ActionResult } from "./action-registry";
import type { JsonPatchOp } from "./rfc6902";
import { sanitizeUrl } from "./url-policy";

// =============================================================================
// Types
// =============================================================================

/**
 * Callbacks the host provides for each ActionResult variant.
 * The processor dispatches to these based on `result.type`.
 */
export interface ActionResultCallbacks {
  /** Apply RFC 6902 patches to the UITree. */
  readonly applyPatches: (patches: readonly JsonPatchOp[]) => void;
  /** Send content as a new chat message (e.g. form submissions). */
  readonly sendMessage: (content: string) => void;
  /** Open a URL externally (default: window.open). */
  readonly openExternal?: (url: string, target: string) => void;
}

// =============================================================================
// Default external handler
// =============================================================================

/** Default implementation opens a URL in a new tab. */
function defaultOpenExternal(url: string, target: string): void {
  window.open(url, target);
}

// =============================================================================
// Processor
// =============================================================================

/**
 * Process an ActionResult from the registry by dispatching to the
 * appropriate host callback.
 *
 * - `patch`    → applyPatches(result.patches)
 * - `message`  → sendMessage(result.content)
 * - `external` → openExternal(result.url, result.target ?? "_blank")
 * - `none`     → no-op
 */
export function processActionResult(
  result: ActionResult,
  callbacks: ActionResultCallbacks,
): void {
  switch (result.type) {
    case "patch":
      callbacks.applyPatches(result.patches);
      break;
    case "message":
      callbacks.sendMessage(result.content);
      break;
    case "external": {
      const decision = sanitizeUrl(result.url);
      if (!decision.ok) {
        console.warn(
          `[kumo-stream] blocked external URL (${decision.reason}): ${result.url}`,
        );
        break;
      }
      const open = callbacks.openExternal ?? defaultOpenExternal;
      open(decision.url, result.target ?? "_blank");
      break;
    }
    case "none":
      break;
  }
}
