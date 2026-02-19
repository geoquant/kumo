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
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

import { SYSTEM_PROMPT } from "../src/core/system-prompt.js";

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

  /** Send one SSE frame. */
  function send(payload: Record<string, unknown>): void {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
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
      res.end();
    });

    stream.on("error", (err) => {
      console.error("[/api/chat] Anthropic stream error:", err.message);
      send({ type: "error", message: err.message });
      res.end();
    });

    // If the client disconnects, abort the Anthropic stream
    req.on("close", () => {
      stream.controller.abort();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    console.error("[/api/chat] Error:", message);
    send({ type: "error", message });
    res.end();
  }
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
});
