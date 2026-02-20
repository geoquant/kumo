/**
 * Express proxy server for the cross-boundary demo.
 *
 * Streams Anthropic responses as SSE so the API key stays server-side.
 * The cross-boundary HTML page (public/cross-boundary.html) connects via
 * EventSource-compatible fetch and feeds deltas into the UMD bundle's
 * JSONL parser + patch pipeline.
 *
 * SSE wire format:
 *   data: {"type":"text","delta":"..."}\n\n   — streamed text chunk
 *   data: {"type":"done"}\n\n                 — stream complete
 *   data: {"type":"error","message":"..."}\n\n — stream failure
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

import { renderTreeToDpuTemplate } from "../src/core/dpu-snapshot.js";
import { createJsonlParser } from "../src/core/jsonl-parser.js";
import { sanitizePatch } from "../src/core/text-sanitizer.js";
import {
  applyPatch as applyRfc6902Patch,
  type JsonPatchOp,
} from "../src/core/rfc6902.js";
import { EMPTY_TREE, type UITree } from "../src/core/types.js";

import { SYSTEM_PROMPT } from "../src/core/system-prompt.js";
import { buildGenerativeUiManifest } from "../src/core/generative-ui-manifest.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

// SSE can get extremely chatty (token-level deltas). Buffering reduces write
// frequency and client JSON parsing overhead, but can feel bursty.
// Default is effectively "off"; opt-in via env.
const SSE_FLUSH_MS = parseInt(process.env.SSE_FLUSH_MS ?? "0", 10);
const SSE_MAX_BUFFER_CHARS = parseInt(
  process.env.SSE_MAX_BUFFER_CHARS ?? "1",
  10,
);

// DPU mode emits full HTML snapshots; optional throttle.
const DPU_SNAPSHOT_FLUSH_MS = parseInt(
  process.env.DPU_SNAPSHOT_FLUSH_MS ?? "0",
  10,
);

// In dev, proxies may not surface headers until first body bytes. SSE comment
// keepalives force an early flush so the client sees the stream immediately.
const SSE_KEEPALIVE_MS = parseInt(process.env.SSE_KEEPALIVE_MS ?? "15000", 10);

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Add it to .env at the project root.",
    );
  }
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());

// Serve the loadable UMD bundle + CSS
app.use(
  "/dist/loadable",
  express.static(path.join(PROJECT_ROOT, "dist/loadable")),
);

// Serve static HTML pages (cross-boundary demo lives here)
app.use(express.static(path.join(PROJECT_ROOT, "public")));

// ---------------------------------------------------------------------------
// .well-known routes — canonical discovery endpoints for generative UI assets
// ---------------------------------------------------------------------------

const LOADABLE_DIR = path.join(PROJECT_ROOT, "dist/loadable");

/**
 * Resolve the @cloudflare/kumo package directory from node_modules.
 * Works for both pnpm workspace symlinks and regular installs.
 */
const KUMO_PKG_DIR = fs.realpathSync(
  path.join(PROJECT_ROOT, "node_modules/@cloudflare/kumo"),
);

app.get("/.well-known/component-loadable.umd.js", (_req, res) => {
  res.sendFile(path.join(LOADABLE_DIR, "component-loadable.umd.js"));
});

app.get("/.well-known/stylesheet.css", (_req, res) => {
  res.sendFile(path.join(LOADABLE_DIR, "style.css"));
});

app.get("/.well-known/component-registry.json", (_req, res) => {
  res.sendFile(path.join(KUMO_PKG_DIR, "ai/component-registry.json"));
});

app.get("/.well-known/generative-ui.json", (_req, res) => {
  const kumoVersion = JSON.parse(
    fs.readFileSync(path.join(KUMO_PKG_DIR, "package.json"), "utf8"),
  ).version as string;

  res.json(buildGenerativeUiManifest({ kumoVersion }));
});

// ---------------------------------------------------------------------------
// POST /api/chat — SSE streaming endpoint
// ---------------------------------------------------------------------------

interface ChatRequestBody {
  readonly message: string;
  readonly history?: ReadonlyArray<{ role: string; content: string }>;
  readonly renderMode?: "jsonl" | "dpu";
}

app.post("/api/chat", async (req, res) => {
  const { message, history, renderMode } = req.body as ChatRequestBody;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty 'message' field" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Reduce latency for small writes.
  res.socket?.setNoDelay(true);

  // Force the first bytes out ASAP (client ignores non-`data:` lines).
  res.write(`:\n\n`);

  let closed = false;

  const keepaliveTimer: ReturnType<typeof setInterval> | null =
    SSE_KEEPALIVE_MS > 0
      ? setInterval(() => {
          if (closed) return;
          try {
            res.write(`:\n\n`);
          } catch {
            closed = true;
          }
        }, SSE_KEEPALIVE_MS)
      : null;

  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let textBuffer = "";

  function clearFlushTimer(): void {
    if (flushTimer == null) return;
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  function clearKeepaliveTimer(): void {
    if (keepaliveTimer == null) return;
    clearInterval(keepaliveTimer);
  }

  function flushTextBuffer(): void {
    if (textBuffer.length === 0) return;
    const delta = textBuffer;
    textBuffer = "";
    send({ type: "text", delta });
  }

  function scheduleTextFlush(): void {
    if (SSE_FLUSH_MS <= 0) {
      clearFlushTimer();
      flushTextBuffer();
      return;
    }
    if (flushTimer != null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushTextBuffer();
    }, SSE_FLUSH_MS);
  }

  /** Send one SSE frame. Guards against writing to a closed response. */
  function send(payload: Record<string, unknown>): void {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // Connection already closed — ignore
      closed = true;
      clearFlushTimer();
      clearKeepaliveTimer();
    }
  }

  /** Safely end the response. */
  function end(): void {
    if (closed) return;
    closed = true;
    clearFlushTimer();
    clearKeepaliveTimer();
    try {
      res.end();
    } catch {
      // Already ended — ignore
    }
  }

  try {
    const client = getClient();

    // Build Anthropic message array from optional history + current message
    const messages: Anthropic.MessageParam[] = [];

    if (history && Array.isArray(history)) {
      for (const entry of history) {
        if (entry.role === "user" || entry.role === "assistant") {
          messages.push({
            role: entry.role,
            content: entry.content,
          });
        }
      }
    }

    messages.push({ role: "user", content: message.trim() });

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    const mode = renderMode === "dpu" ? "dpu" : "jsonl";

    if (mode === "dpu") {
      const parser = createJsonlParser();
      let tree: UITree = EMPTY_TREE;

      let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
      let snapshotScheduled = false;

      function applyOps(ops: readonly JsonPatchOp[]): void {
        for (const op of ops) {
          tree = applyRfc6902Patch(tree, sanitizePatch(op));
        }
      }

      function emitSnapshot(): void {
        const html = renderTreeToDpuTemplate(tree, { mode: "light" });
        send({ type: "template", html });
      }

      function clearSnapshotTimer(): void {
        if (snapshotTimer == null) return;
        clearTimeout(snapshotTimer);
        snapshotTimer = null;
        snapshotScheduled = false;
      }

      function scheduleSnapshot(): void {
        if (DPU_SNAPSHOT_FLUSH_MS <= 0) {
          emitSnapshot();
          return;
        }
        if (snapshotScheduled) return;
        snapshotScheduled = true;
        snapshotTimer = setTimeout(() => {
          snapshotTimer = null;
          snapshotScheduled = false;
          emitSnapshot();
        }, DPU_SNAPSHOT_FLUSH_MS);
      }

      stream.on("text", (delta) => {
        const ops = parser.push(delta);
        if (ops.length === 0) return;
        applyOps(ops);
        scheduleSnapshot();
      });

      stream.on("finalMessage", () => {
        clearSnapshotTimer();
        const remaining = parser.flush();
        if (remaining.length > 0) {
          applyOps(remaining);
        }

        emitSnapshot();
        send({ type: "done" });
        end();
      });
    } else {
      stream.on("text", (delta) => {
        if (closed) return;
        if (SSE_FLUSH_MS <= 0 || SSE_MAX_BUFFER_CHARS <= 1) {
          send({ type: "text", delta });
          return;
        }

        textBuffer += delta;
        if (textBuffer.length >= SSE_MAX_BUFFER_CHARS) {
          clearFlushTimer();
          flushTextBuffer();
          return;
        }
        scheduleTextFlush();
      });

      stream.on("finalMessage", () => {
        clearFlushTimer();
        flushTextBuffer();
        send({ type: "done" });
        end();
      });
    }

    stream.on("error", (err) => {
      // Ignore abort errors — expected when the client disconnects
      const isAbort =
        err.name === "APIUserAbortError" ||
        err.message === "Request was aborted.";
      if (isAbort || closed) return;
      console.error("[/api/chat] Anthropic stream error:", err.message);

      // Flush any buffered text so the client keeps partial output.
      clearFlushTimer();
      flushTextBuffer();

      send({ type: "error", message: err.message });
      end();
    });

    // If the client disconnects, abort the Anthropic stream.
    // Listen on `res` not `req` — req.close fires when the request body
    // is fully read (immediately for POST), not when the client disconnects.
    res.on("close", () => {
      if (closed) return; // Already ended normally
      console.log("[/api/chat] Client disconnected");
      closed = true;
      clearFlushTimer();
      try {
        stream.controller.abort();
      } catch {
        // Stream may already be finished — ignore
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    console.error("[/api/chat] Error:", msg);
    send({ type: "error", message: msg });
    end();
  }
});

// ---------------------------------------------------------------------------
// Process-level error handlers (prevent crash on unhandled abort errors)
// ---------------------------------------------------------------------------

process.on("unhandledRejection", (reason) => {
  // APIUserAbortError is expected when clients disconnect during streaming.
  // Check both class name and message since transpilation may mangle names.
  if (reason instanceof Error) {
    const isAbort =
      reason.name === "APIUserAbortError" ||
      reason.message === "Request was aborted.";
    if (isAbort) return;
  }
  console.error("[unhandledRejection]", reason);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server ready: http://localhost:${PORT}`);
  console.log(
    `Cross-boundary demo: http://localhost:${PORT}/cross-boundary.html`,
  );
  console.log(`Serving UMD bundle from: dist/loadable/`);
  console.log(
    `Discovery endpoint: http://localhost:${PORT}/.well-known/generative-ui.json`,
  );
});
