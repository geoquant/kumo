import { useRef } from "react";
import { useLoaderData } from "react-router";
import { z } from "zod";
import { waitForRenderData, useMcpUiInit } from "../../utils/mcp.js";

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
// Default component — renders confirmation card with worker name
// ---------------------------------------------------------------------------

export default function CreateWorkerConfirm() {
  const { workerName, toolId } = useLoaderData<RenderData>();
  const rootRef = useRef<HTMLDivElement>(null);

  useMcpUiInit(rootRef);

  return (
    <div ref={rootRef} data-tool-id={toolId} style={{ padding: "1rem" }}>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "1.5rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: 18, fontWeight: 600 }}>
          Create Worker
        </h2>
        <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: 14 }}>
          Ready to create worker <strong>{workerName}</strong>
        </p>
      </div>
    </div>
  );
}
