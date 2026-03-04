import { useCallback, useEffect, useRef, useState } from "react";
import { useLoaderData } from "react-router";
import { z } from "zod";
import type { UITree, ActionDispatch } from "@cloudflare/kumo/streaming";
import { UITreeRenderer } from "@cloudflare/kumo/generative";
import { waitForRenderData, useMcpUiInit } from "../../utils/mcp.js";
import {
  streamConfirmationCard,
  type ConfirmationCardStatus,
} from "../../utils/stream-confirmation-card.js";

// ---------------------------------------------------------------------------
// Render data schema — matches uiMetadata from create_worker tool
// ---------------------------------------------------------------------------

const renderDataSchema = z.object({
  workerName: z.string(),
  toolId: z.string(),
});

type RenderData = z.infer<typeof renderDataSchema>;

// ---------------------------------------------------------------------------
// clientLoader — runs in the browser, waits for host to send render data
// ---------------------------------------------------------------------------

export async function clientLoader() {
  const renderData = await waitForRenderData(renderDataSchema);
  return renderData;
}

// ---------------------------------------------------------------------------
// HydrateFallback — shown while clientLoader is pending
// ---------------------------------------------------------------------------

export function HydrateFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "120px",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <svg
        style={{ width: 32, height: 32, marginBottom: 12 }}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Loading"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          opacity={0.25}
        />
        <path
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          fill="currentColor"
          opacity={0.75}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      <p style={{ color: "#666", margin: 0, fontSize: 14 }}>
        Waiting for render data...
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty tree constant (avoids importing EMPTY_TREE to keep bundle small)
// ---------------------------------------------------------------------------

const EMPTY_TREE: UITree = { root: "", elements: {} };

// ---------------------------------------------------------------------------
// Default component — streams confirmation card from AI, renders via
// UITreeRenderer, manages status lifecycle.
// ---------------------------------------------------------------------------

export default function CreateWorkerConfirm() {
  const { workerName, toolId } = useLoaderData<RenderData>();
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [tree, setTree] = useState<UITree>(EMPTY_TREE);
  const [status, setStatus] = useState<ConfirmationCardStatus>("streaming");

  useMcpUiInit(rootRef);

  // -------------------------------------------------------------------------
  // Stream the confirmation card from the AI on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    void streamConfirmationCard(
      {
        message: `Create a worker named "${workerName}"`,
        toolId,
        signal: controller.signal,
      },
      {
        onTreeUpdate: (updatedTree) => {
          setTree(updatedTree);
        },
        onComplete: (finalTree) => {
          setTree(finalTree);
          setStatus("pending");
        },
        onError: (error, partialTree) => {
          // If we got a partial tree with content, show it in pending state
          // so the user can still interact. Otherwise show error.
          const hasContent =
            partialTree.root !== "" &&
            Object.keys(partialTree.elements).length > 0;

          setTree(partialTree);
          setStatus(hasContent ? "pending" : "error");

          if (!hasContent) {
            console.error("[create-worker-confirm] stream error:", error);
          }
        },
      },
    );

    return () => {
      controller.abort();
    };
  }, [workerName, toolId]);

  // -------------------------------------------------------------------------
  // Action handler — receives UITreeRenderer action events
  // (tool_approve / tool_cancel from the rendered card buttons)
  // -------------------------------------------------------------------------

  const handleAction = useCallback<ActionDispatch>(
    (event) => {
      // Only allow actions when the card is in pending state
      if (status !== "pending") return;

      if (event.actionName === "tool_approve") {
        setStatus("applying");
        // iframe-app-3 will wire approve → sendMcpMessage to host
      } else if (event.actionName === "tool_cancel") {
        setStatus("cancelled");
        // iframe-app-3 will wire cancel → notify host
      }
    },
    [status],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isStreaming = status === "streaming";
  const hasTree = tree.root !== "" && Object.keys(tree.elements).length > 0;

  if (status === "error" && !hasTree) {
    return (
      <div ref={rootRef} data-tool-id={toolId} style={{ padding: "1rem" }}>
        <div
          style={{
            border: "1px solid #ef4444",
            borderRadius: 8,
            padding: "1.5rem",
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#ef4444",
          }}
        >
          <p style={{ margin: 0, fontSize: 14 }}>
            Failed to load confirmation card. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} data-tool-id={toolId}>
      {hasTree ? (
        <UITreeRenderer
          tree={tree}
          streaming={isStreaming}
          onAction={status === "pending" ? handleAction : undefined}
        />
      ) : (
        // Show spinner while streaming before any tree content arrives
        <HydrateFallback />
      )}
    </div>
  );
}
