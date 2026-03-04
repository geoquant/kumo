import { useCallback, useEffect, useRef, useState } from "react";
import { useLoaderData } from "react-router";
import { z } from "zod";
import type { UITree, ActionDispatch } from "@cloudflare/kumo/streaming";
import { UITreeRenderer } from "@cloudflare/kumo/generative";
import {
  waitForRenderData,
  useMcpUiInit,
  sendMcpMessage,
} from "../../utils/mcp.js";
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
// Schema for execute_create_worker response — validated via sendMcpMessage
// ---------------------------------------------------------------------------

const executeResultSchema = z.object({
  structuredContent: z.object({
    success: z.boolean(),
    workerName: z.string(),
    createdAt: z.string(),
  }),
});

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

        void sendMcpMessage(
          "tool",
          {
            toolName: "execute_create_worker",
            params: { workerName },
          },
          { schema: executeResultSchema },
        ).then(
          (result) => {
            if (result.structuredContent.success) {
              setStatus("completed");
            } else {
              // Server returned success:false — allow retry
              setStatus("pending");
            }
          },
          (err) => {
            console.error("[create-worker-confirm] execute error:", err);
            // Revert to pending so the user can retry
            setStatus("pending");
          },
        );
      } else if (event.actionName === "tool_cancel") {
        setStatus("cancelled");

        // Notify host about cancellation (fire-and-forget)
        void sendMcpMessage("tool", {
          toolName: "cancel_tool",
          params: { toolId },
        }).catch(() => {
          // Best-effort — host may not have a cancel handler
        });
      }
    },
    [status, workerName, toolId],
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
        <div style={{ position: "relative" }}>
          <div
            style={{
              opacity: status === "cancelled" ? 0.5 : 1,
              pointerEvents: status === "pending" ? "auto" : "none",
              transition: "opacity 200ms ease-in-out",
            }}
          >
            <UITreeRenderer
              tree={tree}
              streaming={isStreaming}
              onAction={status === "pending" ? handleAction : undefined}
            />
          </div>

          {/* Applying overlay — semi-transparent with spinner */}
          {status === "applying" && (
            <StatusOverlay>
              <Spinner size={28} />
            </StatusOverlay>
          )}

          {/* Completed overlay — check icon */}
          {status === "completed" && (
            <StatusOverlay>
              <CheckIcon size={36} />
            </StatusOverlay>
          )}
        </div>
      ) : (
        // Show spinner while streaming before any tree content arrives
        <HydrateFallback />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status overlay components — inline SVGs to avoid icon library bundle cost
// ---------------------------------------------------------------------------

function StatusOverlay({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.6)",
        borderRadius: 8,
        zIndex: 10,
      }}
    >
      {children}
    </div>
  );
}

function Spinner({ size = 24 }: { readonly size?: number }) {
  return (
    <svg
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Applying"
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
  );
}

function CheckIcon({ size = 24 }: { readonly size?: number }) {
  return (
    <svg
      style={{ width: size, height: size, color: "#22c55e" }}
      viewBox="0 0 256 256"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Completed"
    >
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}
