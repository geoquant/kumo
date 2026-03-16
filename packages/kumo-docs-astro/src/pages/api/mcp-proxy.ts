import type { APIRoute } from "astro";

export const prerender = false;

// ---------------------------------------------------------------------------
// MCP JSON-RPC types (subset used by the proxy)
// ---------------------------------------------------------------------------

/**
 * Standard JSON-RPC 2.0 request envelope used by MCP streamable HTTP.
 *
 * @see https://spec.modelcontextprotocol.io/specification/basic/transports/#streamable-http
 */
interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 error object. */
interface JsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

/**
 * Subset of a JSON-RPC response that we need to inspect.
 * The full MCP spec also supports notifications (no `id`) and SSE responses,
 * but we only consume synchronous `application/json` results here.
 */
interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: number;
  readonly result?: unknown;
  readonly error?: JsonRpcError;
}

// ---------------------------------------------------------------------------
// Proxy request shape (from the frontend)
// ---------------------------------------------------------------------------

interface McpProxyRequest {
  readonly toolName: string;
  readonly params: Record<string, unknown>;
}

interface RuntimeEnvBindings {
  readonly CHAT_RATE_LIMIT?: WorkersRateLimit;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Base URL for the kumo-mcp Worker.
 * In dev, `@cloudflare/vite-plugin` serves the Worker through Vite's dev
 * server (default port 5173). In production/staging, this would be a
 * service binding or deployed URL.
 */
const MCP_BASE_URL = import.meta.env.MCP_BASE_URL ?? "http://localhost:5173";

/**
 * Required `Accept` header for MCP streamable HTTP transport.
 * Omitting `text/event-stream` triggers a -32000 error.
 */
const MCP_ACCEPT_HEADER = "application/json, text/event-stream";

/**
 * Timeout (ms) for individual MCP fetch calls.
 * Initialize + tools/call = two round-trips, so each gets its own budget.
 */
const MCP_FETCH_TIMEOUT_MS = 15_000;

/** Maximum length for toolName to prevent abuse. */
const MAX_TOOL_NAME_LENGTH = 100;

/** Maximum JSON payload size (characters) to prevent abuse. */
const MAX_PARAMS_JSON_LENGTH = 10_000;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Type guard for non-null, non-array objects. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isWorkersRateLimit(v: unknown): v is WorkersRateLimit {
  return isPlainObject(v) && typeof v["limit"] === "function";
}

function getRuntimeEnv(locals: App.Locals): RuntimeEnvBindings | null {
  if (!isPlainObject(locals.runtime)) return null;
  const env = locals.runtime["env"];
  if (!isPlainObject(env)) return null;

  return {
    CHAT_RATE_LIMIT: isWorkersRateLimit(env["CHAT_RATE_LIMIT"])
      ? env["CHAT_RATE_LIMIT"]
      : undefined,
  };
}

/** Type guard: is the value a valid JSON-RPC 2.0 response? */
function isJsonRpcResponse(v: unknown): v is JsonRpcResponse {
  if (!isPlainObject(v)) return false;
  return v["jsonrpc"] === "2.0" && typeof v["id"] === "number";
}

/**
 * Validate and parse the incoming proxy request body.
 * Returns the parsed request or null if invalid.
 */
function parseProxyRequest(body: unknown): McpProxyRequest | null {
  if (!isPlainObject(body)) return null;

  const toolName = body["toolName"];
  if (
    typeof toolName !== "string" ||
    toolName.length === 0 ||
    toolName.length > MAX_TOOL_NAME_LENGTH
  ) {
    return null;
  }

  const params = body["params"];
  if (!isPlainObject(params)) return null;

  // Guard against oversized param payloads.
  const serialized = JSON.stringify(params);
  if (serialized.length > MAX_PARAMS_JSON_LENGTH) return null;

  return { toolName, params };
}

// ---------------------------------------------------------------------------
// MCP transport helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Send a JSON-RPC request to the MCP server and parse the response.
 *
 * Returns the parsed JSON-RPC response body, or throws on network/parse errors.
 * The optional `sessionId` header is forwarded to maintain session affinity
 * across the initialize → tools/call sequence.
 */
async function mcpFetch(
  request: JsonRpcRequest,
  sessionId?: string,
): Promise<{ body: JsonRpcResponse; sessionId?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: MCP_ACCEPT_HEADER,
  };
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const response = await fetch(`${MCP_BASE_URL}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(MCP_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `MCP server responded with ${response.status}: ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";

  let body: unknown;
  if (contentType.includes("text/event-stream")) {
    // SSE response — parse the first `data:` line that contains our JSON-RPC result.
    body = await parseSseResponse(response);
  } else {
    body = await response.json();
  }

  if (!isJsonRpcResponse(body)) {
    throw new Error("Invalid JSON-RPC response from MCP server");
  }

  const returnedSessionId = response.headers.get("mcp-session-id") ?? sessionId;

  return {
    body,
    sessionId: returnedSessionId ?? undefined,
  };
}

/**
 * Parse the first complete JSON-RPC message from an SSE stream.
 *
 * MCP streamable HTTP may return `text/event-stream` for any request.
 * We consume the stream until we find the first `data:` line with a valid
 * JSON-RPC response (identified by having an `id` field).
 */
async function parseSseResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;

    const payload = trimmed.slice("data:".length).trim();
    if (payload === "[DONE]") continue;

    try {
      const parsed: unknown = JSON.parse(payload);
      if (isPlainObject(parsed) && "id" in parsed) {
        return parsed;
      }
    } catch {
      // Not valid JSON — skip this SSE line.
    }
  }

  throw new Error("No JSON-RPC response found in SSE stream");
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/mcp-proxy — thin proxy that forwards tool calls to the
 * kumo-mcp Worker via MCP streamable HTTP transport.
 *
 * Accepts: `{ toolName: string; params: Record<string, unknown> }`
 * Returns: `{ content, structuredContent }` from MCP tool result.
 *
 * The proxy performs the full MCP session lifecycle per request:
 * 1. `initialize` — establish session, get session ID
 * 2. `notifications/initialized` — client ready notification
 * 3. `tools/call` — execute the requested tool
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);

  // --- Rate limiting (reuse CHAT_RATE_LIMIT) ---
  const rateLimiter = env?.CHAT_RATE_LIMIT;
  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  try {
    if (clientIp && rateLimiter) {
      const { success } = await rateLimiter.limit({ key: clientIp });
      if (!success) {
        return jsonResponse(
          { error: "Rate limited. Try again in a minute." },
          429,
        );
      }
    } else if (!import.meta.env.DEV) {
      if (!clientIp) {
        return jsonResponse({ error: "Unable to identify client." }, 400);
      }

      console.warn("[mcp-proxy] CHAT_RATE_LIMIT binding unavailable; skipping");
    }
  } catch (rateLimitErr) {
    console.error("[mcp-proxy] rate limiter unavailable:", rateLimitErr);
    if (!import.meta.env.DEV) {
      return jsonResponse(
        { error: "Rate limiting unavailable. Try again." },
        503,
      );
    }
  }

  // --- Parse request body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const proxyRequest = parseProxyRequest(body);
  if (!proxyRequest) {
    return jsonResponse(
      {
        error:
          "Invalid request. Expected { toolName: string; params: Record<string, unknown> }",
      },
      400,
    );
  }

  // --- MCP session: initialize → initialized notification → tools/call ---
  try {
    // 1. Initialize session
    const initResult = await mcpFetch({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "kumo-docs-proxy", version: "0.0.1" },
      },
    });

    if (initResult.body.error) {
      console.error("[mcp-proxy] initialize error:", initResult.body.error);
      return jsonResponse(
        { error: `MCP initialize failed: ${initResult.body.error.message}` },
        502,
      );
    }

    const sessionId = initResult.sessionId;

    // 2. Send initialized notification (no id — it's a notification)
    // Notifications are fire-and-forget; we send but don't await a response.
    const notificationHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: MCP_ACCEPT_HEADER,
    };
    if (sessionId) {
      notificationHeaders["mcp-session-id"] = sessionId;
    }

    await fetch(`${MCP_BASE_URL}/mcp`, {
      method: "POST",
      headers: notificationHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      signal: AbortSignal.timeout(MCP_FETCH_TIMEOUT_MS),
    });

    // 3. Call the tool
    const toolResult = await mcpFetch(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: proxyRequest.toolName,
          arguments: proxyRequest.params,
        },
      },
      sessionId,
    );

    if (toolResult.body.error) {
      console.error("[mcp-proxy] tools/call error:", toolResult.body.error);
      return jsonResponse(
        { error: `MCP tool call failed: ${toolResult.body.error.message}` },
        502,
      );
    }

    // 4. Extract and forward the tool result
    const result = toolResult.body.result;
    if (!isPlainObject(result)) {
      return jsonResponse({ error: "Unexpected tool result shape." }, 502);
    }

    const toolResponse: Record<string, unknown> = {};

    if ("content" in result && Array.isArray(result["content"])) {
      toolResponse["content"] = result["content"];
    }

    if (
      "structuredContent" in result &&
      isPlainObject(result["structuredContent"])
    ) {
      toolResponse["structuredContent"] = result["structuredContent"];
    }

    return jsonResponse(toolResponse, 200);
  } catch (err) {
    console.error("[mcp-proxy] error:", err);

    const message =
      err instanceof Error ? err.message : "MCP proxy request failed.";

    // Distinguish timeout from other errors
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return jsonResponse({ error: "MCP server timed out." }, 504);
    }

    return jsonResponse({ error: message }, 502);
  }
};
