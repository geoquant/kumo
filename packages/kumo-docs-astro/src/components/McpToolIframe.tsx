/**
 * McpToolIframe — renders a tool confirmation card inside an `<iframe>`,
 * bridging the host ↔ iframe postMessage protocol via
 * {@link createIframeMessageHandler}.
 *
 * Replaces the inline `UITreeRenderer`-based tool card rendering with an
 * isolated iframe that streams its own UI, receives render data on mount,
 * and communicates tool actions (approve / cancel) back to the host.
 */

import { useEffect, useRef, useState } from "react";
import { cn, Loader } from "@cloudflare/kumo";
import { CheckIcon } from "@phosphor-icons/react";
import {
  createIframeMessageHandler,
  type IframeMessageHandler,
} from "~/lib/mcp-host";

// ---------------------------------------------------------------------------
// Status type — mirrors ToolMessageStatus from _PlaygroundPage.tsx.
// Kept as a local alias so this component doesn't depend on PlaygroundPage.
// ---------------------------------------------------------------------------

/** Status of the iframe tool card lifecycle. */
export type ToolIframeStatus =
  | "streaming"
  | "pending"
  | "approved"
  | "cancelled"
  | "applying"
  | "completed";

// ---------------------------------------------------------------------------
// Callback types
// ---------------------------------------------------------------------------

/** Payload forwarded when the iframe requests a tool call. */
export interface ToolActionPayload {
  readonly toolName: string;
  readonly params: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface McpToolIframeProps {
  /** URL loaded inside the iframe (e.g. `/ui/create-worker-confirm`). */
  readonly src: string;
  /** Data delivered to the iframe when it signals readiness. */
  readonly renderData: Record<string, unknown>;
  /** Current lifecycle status — drives overlay rendering. */
  readonly status: ToolIframeStatus;
  /** Called when the iframe posts a tool action message. */
  readonly onToolAction: (payload: ToolActionPayload) => void;
  /** Called when the iframe changes status (e.g. size-triggered transitions). */
  readonly onStatusChange?: (status: ToolIframeStatus) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default iframe height before the iframe reports its own dimensions. */
const DEFAULT_HEIGHT = 280;

/** Minimum height to prevent collapsed iframes. */
const MIN_HEIGHT = 80;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function McpToolIframe({
  src,
  renderData,
  status,
  onToolAction,
  onStatusChange: _onStatusChange,
}: McpToolIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handlerRef = useRef<IframeMessageHandler | null>(null);
  const [iframeHeight, setIframeHeight] = useState(DEFAULT_HEIGHT);

  // -------------------------------------------------------------------------
  // Stable callback refs to avoid re-running the effect when the caller's
  // identity changes (common with inline arrow functions).
  // -------------------------------------------------------------------------
  const onToolActionRef = useRef(onToolAction);
  onToolActionRef.current = onToolAction;

  /** Track whether we've already signalled "pending" (first resize). */
  const hasSignalledReady = useRef(false);

  // -------------------------------------------------------------------------
  // Set up postMessage handler when iframe mounts
  // -------------------------------------------------------------------------
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handler = createIframeMessageHandler({
      iframe,
      renderData,

      onToolCall(toolName, params) {
        onToolActionRef.current({ toolName, params });
        // Return value is forwarded to the iframe as the tool response.
        // The actual tool execution happens in the host (PlaygroundPage),
        // so we return undefined — the host-2 task will wire the MCP
        // proxy and populate a real response.
        return undefined;
      },

      onResize(height, _width) {
        setIframeHeight(Math.max(height, MIN_HEIGHT));

        // First non-zero resize signals the iframe has rendered content.
        // Transition from "streaming" → "pending" so the iframe becomes
        // visible and interactive.
        if (!hasSignalledReady.current && height > 0) {
          hasSignalledReady.current = true;
          _onStatusChange?.("pending");
        }
      },
    });

    handlerRef.current = handler;

    return () => {
      handler.cleanup();
      handlerRef.current = null;
    };
    // renderData identity should be stable per tool message — avoid deep
    // comparison; the parent must memoize or use a stable reference.
  }, [renderData]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className={cn(
        "w-full overflow-hidden relative rounded-lg",
        status === "streaming" && "pointer-events-none",
        status === "cancelled" &&
          "opacity-50 pointer-events-none [&_h1]:line-through [&_h2]:line-through [&_h3]:line-through [&_span]:line-through",
        (status === "applying" || status === "completed") &&
          "pointer-events-none",
      )}
    >
      {/* Streaming placeholder — shown before iframe content is ready */}
      {status === "streaming" && (
        <div className="flex items-center gap-2 rounded-lg border border-kumo-line bg-kumo-elevated p-4">
          <Loader size="sm" />
          <span className="text-sm text-kumo-subtle">
            Generating confirmation…
          </span>
        </div>
      )}

      {/* The iframe — hidden during initial streaming to avoid layout flash */}
      <iframe
        ref={iframeRef}
        src={src}
        title="Tool confirmation"
        sandbox="allow-scripts allow-same-origin"
        className={cn("w-full border-0", status === "streaming" && "sr-only")}
        style={{ height: status === "streaming" ? 0 : iframeHeight }}
      />

      {/* Applying overlay — semi-transparent with spinner */}
      {status === "applying" && (
        <div className="absolute inset-0 flex items-center justify-center bg-kumo-base/60 rounded-lg">
          <Loader size="sm" />
        </div>
      )}

      {/* Completed overlay — check icon + label */}
      {status === "completed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-kumo-base/60 rounded-lg">
          <div className="flex items-center gap-1.5 text-sm text-kumo-success">
            <CheckIcon className="size-4" />
            <span className="font-medium">Applied</span>
          </div>
        </div>
      )}
    </div>
  );
}

McpToolIframe.displayName = "McpToolIframe";
