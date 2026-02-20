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

import { SYSTEM_PROMPT } from "../src/core/system-prompt.js";
import { buildGenerativeUiManifest } from "../src/core/generative-ui-manifest.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

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
}

app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body as ChatRequestBody;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty 'message' field" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let closed = false;

  /** Send one SSE frame. Guards against writing to a closed response. */
  function send(payload: Record<string, unknown>): void {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // Connection already closed — ignore
      closed = true;
    }
  }

  /** Safely end the response. */
  function end(): void {
    if (closed) return;
    closed = true;
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
      system: SYSTEM_PROMPT,
      messages,
    });

    stream.on("text", (delta) => {
      send({ type: "text", delta });
    });

    stream.on("finalMessage", () => {
      send({ type: "done" });
      end();
    });

    stream.on("error", (err) => {
      // Ignore abort errors — expected when the client disconnects
      const isAbort =
        err.name === "APIUserAbortError" ||
        err.message === "Request was aborted.";
      if (isAbort || closed) return;
      console.error("[/api/chat] Anthropic stream error:", err.message);
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
