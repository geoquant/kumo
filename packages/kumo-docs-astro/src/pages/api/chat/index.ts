import type { APIRoute } from "astro";
import { getSystemPrompt } from "~/lib/playground";
import { getSkillContents } from "~/lib/skills-data.generated";

export const prerender = false;

// ---------------------------------------------------------------------------
// CORS — allow cross-origin requests from the MCP iframe origin
// ---------------------------------------------------------------------------

/**
 * Origins allowed to make cross-origin requests to this endpoint.
 *
 * The MCP confirmation card iframe (served by kumo-mcp on a different origin)
 * needs to fetch `/api/chat` to stream the tool confirmation card UI.
 * In dev this is the Vite dev server; in prod it's the kumo-mcp Worker URL.
 */
const ALLOWED_ORIGINS = new Set([
  // kumo-mcp Vite dev server
  "http://localhost:5173",
  // kumo-mcp wrangler dev server
  "http://localhost:8787",
]);

/**
 * If the production MCP base URL is configured, add it to allowed origins.
 * This is set via `MCP_BASE_URL` env var in production deployments.
 */
const prodMcpUrl = import.meta.env.MCP_BASE_URL;
if (typeof prodMcpUrl === "string" && prodMcpUrl.length > 0) {
  try {
    ALLOWED_ORIGINS.add(new URL(prodMcpUrl).origin);
  } catch {
    // Invalid URL — skip
  }
}

/** Return CORS headers if the request origin is allowed, or empty headers. */
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    Vary: "Origin",
  };
}

/** Handle CORS preflight requests. */
export const OPTIONS: APIRoute = ({ request }) => {
  const cors = getCorsHeaders(request);
  if (Object.keys(cors).length === 0) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: cors });
};

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Maximum length (in characters) for a single user message. */
const MAX_MESSAGE_LENGTH = 2000;

/** Maximum length (in characters) for each history entry. */
const MAX_HISTORY_ENTRY_LENGTH = 4000;

/** Maximum length (in characters) for a system prompt override.
 *  The canonical system prompt from `getSystemPrompt()` is ~75 000 chars,
 *  so the limit must exceed that to allow the PromptEditor to send an
 *  edited copy back as `systemPromptOverride`. */
const MAX_SYSTEM_PROMPT_OVERRIDE_LENGTH = 200_000;

/** Maximum number of history entries accepted in a request. */
const MAX_HISTORY_ENTRIES = 50;

/**
 * Aggregate character budget for the full message array (system + history + user).
 * Prevents cost amplification from many long history entries.
 */
const MAX_TOTAL_MESSAGE_CHARS = 40_000;

/**
 * AI Gateway ID — route Workers AI requests through AI Gateway for
 * analytics and gateway-level rate limiting.
 *
 * Create this gateway in the Cloudflare dashboard under AI → AI Gateway.
 * Caching is disabled so streaming is always visible in the demo.
 */
const AI_GATEWAY_ID = "kumo-docs";

const DEFAULT_MODEL_ID = "@cf/zai-org/glm-4.7-flash";

/** Default max_tokens for standard models. */
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Per-model configuration for Workers AI inference.
 *
 * Reasoning models (gpt-oss) consume completion tokens on chain-of-thought
 * before producing visible output. Without a higher token budget and low
 * reasoning effort, they exhaust `max_tokens` on thinking alone and return
 * zero content tokens — the playground shows "Generated 0 patch ops".
 */
interface ModelConfig {
  readonly fullId: string;
  readonly maxTokens?: number;
  /** Extra params merged into the `env.AI.run()` input (e.g. reasoning effort). */
  readonly extraParams?: Readonly<Record<string, unknown>>;
}

const MODEL_CONFIGS: ReadonlyMap<string, ModelConfig> = new Map([
  [
    "gpt-oss-120b",
    {
      fullId: "@cf/openai/gpt-oss-120b",
      maxTokens: 32768,
      extraParams: { reasoning: { effort: "low" } },
    },
  ],
  ["glm-4.7-flash", { fullId: "@cf/zai-org/glm-4.7-flash" }],
  [
    "llama-4-scout-17b-16e-instruct",
    { fullId: "@cf/meta/llama-4-scout-17b-16e-instruct" },
  ],
  ["gemma-3-27b-it", { fullId: "@cf/google/gemma-3-27b-it" }],
]);

/**
 * Models available in the playground.
 * Keys are the short names accepted in the `model` request field;
 * values are the full Workers AI model identifiers.
 */
const ALLOWED_MODELS: ReadonlyMap<string, string> = new Map(
  [...MODEL_CONFIGS.entries()].map(([short, cfg]) => [short, cfg.fullId]),
);

/** Reverse index: full Workers AI model IDs → short names for lookup. */
const FULL_ID_TO_SHORT = new Map(
  [...ALLOWED_MODELS.entries()].map(([short, full]) => [full, short]),
);

/** Maximum number of skills that can be enabled at once. */
const MAX_SKILL_IDS = 5;

/** Maximum length (in characters) for the current UI tree JSON. */
const MAX_CURRENT_UI_TREE_LENGTH = 20_000;

/** Chat request body schema. */
interface ChatRequest {
  message: string;
  history?: Array<{ role: string; content: string }>;
  model?: string;
  skillIds?: string[];
  /** JSON-serialised UITree from the previous generation, for follow-up turns. */
  currentUITree?: string;
  /**
   * When true, omit the generated system prompt entirely.
   * If `systemPromptOverride` is also provided, it replaces the system prompt.
   * Used for A/B comparison in the playground to evaluate prompt impact.
   */
  skipSystemPrompt?: boolean;
  /**
   * Optional replacement system prompt used when `skipSystemPrompt` is true.
   * Allows experimenting with minimal prompt variants.
   */
  systemPromptOverride?: string;
  /** Optional prompt supplement appended only to the generated system prompt. */
  systemPromptSupplement?: string;
}

/** Workers AI text-generation message format. */
interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function runAiWithGatewayFallback(input: {
  readonly ai: WorkersAi;
  readonly modelId: string;
  readonly body: Record<string, unknown>;
  readonly useGateway: boolean;
}): Promise<ReadableStream | Record<string, unknown>> {
  const gatewayOptions = input.useGateway
    ? {
        gateway: {
          id: AI_GATEWAY_ID,
          cacheTtl: 0,
        },
      }
    : undefined;

  try {
    return await input.ai.run(input.modelId, input.body, gatewayOptions);
  } catch (error) {
    if (!input.useGateway) {
      throw error;
    }

    console.warn(
      "[chat] gateway path failed; retrying direct AI binding",
      error,
    );
    return await input.ai.run(input.modelId, input.body);
  }
}

function getDevChatUpstreamUrls(request: Request): string[] {
  const configured = import.meta.env.DEV_CHAT_UPSTREAM_URL;
  const candidates = [
    typeof configured === "string" ? configured.trim() : "",
    "http://127.0.0.1:8787/api/chat",
    "http://localhost:8787/api/chat",
  ].filter((value) => value.length > 0);

  const currentUrl = new URL(request.url);

  return candidates.filter((value, index) => {
    try {
      const upstream = new URL(value);
      return (
        upstream.origin !== currentUrl.origin &&
        candidates.indexOf(value) === index
      );
    } catch {
      return false;
    }
  });
}

async function proxyDevChatRequest(
  request: Request,
  chatRequest: ChatRequest,
): Promise<Response | null> {
  const upstreamUrls = getDevChatUpstreamUrls(request);

  for (const upstreamUrl of upstreamUrls) {
    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: request.headers.get("Accept") ?? "text/event-stream",
        },
        body: JSON.stringify(chatRequest),
      });

      if (upstreamResponse.ok) {
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: {
            "Content-Type":
              upstreamResponse.headers.get("Content-Type") ??
              "text/event-stream",
            "Cache-Control":
              upstreamResponse.headers.get("Cache-Control") ??
              "no-cache, no-transform",
            Connection:
              upstreamResponse.headers.get("Connection") ?? "keep-alive",
          },
        });
      }

      if (upstreamResponse.status < 500) {
        return upstreamResponse;
      }
    } catch (error) {
      console.warn(`[chat] dev upstream failed: ${upstreamUrl}`, error);
    }
  }

  return null;
}

/** Type guard for non-null, non-array objects. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Type guard for a valid history entry. */
function isHistoryEntry(v: unknown): v is { role: string; content: string } {
  if (!isPlainObject(v)) return false;
  return (
    typeof v["role"] === "string" &&
    typeof v["content"] === "string" &&
    v["content"].length <= MAX_HISTORY_ENTRY_LENGTH
  );
}

/**
 * Validate and parse incoming chat request body.
 * Returns parsed request or null if invalid.
 */
function parseChatRequest(body: unknown): ChatRequest | null {
  if (!isPlainObject(body)) return null;
  if (
    typeof body["message"] !== "string" ||
    body["message"].trim().length === 0
  ) {
    return null;
  }
  const message = body["message"].trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return null;
  }

  let history: ChatRequest["history"] | undefined;
  const rawHistory = body["history"];
  if (Array.isArray(rawHistory)) {
    if (rawHistory.length > MAX_HISTORY_ENTRIES) return null;
    if (!rawHistory.every(isHistoryEntry)) return null;
    history = rawHistory;
  }

  // Model is validated downstream against the allowlist.
  const rawModel = body["model"];
  const model = typeof rawModel === "string" ? rawModel.trim() : undefined;

  // Skill IDs for system prompt injection.
  let skillIds: string[] | undefined;
  const rawSkillIds = body["skillIds"];
  if (Array.isArray(rawSkillIds)) {
    if (rawSkillIds.length > MAX_SKILL_IDS) return null;
    const allStrings = rawSkillIds.every(
      (id: unknown): id is string =>
        typeof id === "string" && id.length > 0 && id.length < 100,
    );
    if (!allStrings) return null;
    skillIds = rawSkillIds;
  }

  // Current UI tree for follow-up turns.
  let currentUITree: string | undefined;
  const rawUITree = body["currentUITree"];
  if (typeof rawUITree === "string") {
    if (rawUITree.length > MAX_CURRENT_UI_TREE_LENGTH) return null;
    currentUITree = rawUITree;
  }

  // System prompt control for A/B comparison.
  const skipSystemPrompt = body["skipSystemPrompt"] === true;
  const rawOverride = body["systemPromptOverride"];
  const systemPromptOverride =
    typeof rawOverride === "string" &&
    rawOverride.length > 0 &&
    rawOverride.length <= MAX_SYSTEM_PROMPT_OVERRIDE_LENGTH
      ? rawOverride
      : undefined;

  const rawSupplement = body["systemPromptSupplement"];
  const systemPromptSupplement =
    typeof rawSupplement === "string" &&
    rawSupplement.length > 0 &&
    rawSupplement.length <= MAX_SYSTEM_PROMPT_OVERRIDE_LENGTH
      ? rawSupplement
      : undefined;

  return {
    message,
    history,
    model: model || undefined,
    skillIds,
    currentUITree,
    skipSystemPrompt,
    systemPromptOverride,
    systemPromptSupplement,
  };
}

/**
 * POST /api/chat — SSE streaming endpoint for Kumo generative UI.
 *
 * Accepts: { message: string; history?: Array<{ role, content }> }
 * Returns: text/event-stream with Workers AI text generation output
 *
 * Rate limited: 100 req/min per IP.
 */
export const POST: APIRoute = async (ctx) => {
  const response = await handlePost(ctx);
  const cors = getCorsHeaders(ctx.request);
  for (const [key, value] of Object.entries(cors)) {
    response.headers.set(key, value);
  }
  return response;
};

const handlePost: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  // --- Rate limiting ---
  const rateLimiter = env.CHAT_RATE_LIMIT;
  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  try {
    if (typeof rateLimiter?.limit === "function" && clientIp) {
      const { success } = await rateLimiter.limit({ key: clientIp });
      if (!success) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again in a minute." }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    } else if (!clientIp && !import.meta.env.DEV) {
      // In production behind Cloudflare, cf-connecting-ip should always exist.
      // If missing, proceed without rate limiting rather than taking down chat.
      console.warn("[chat] missing client ip; skipping rate limit");
    } else if (typeof rateLimiter?.limit !== "function") {
      console.warn("[chat] CHAT_RATE_LIMIT binding unavailable; skipping");
    }
  } catch (rateLimitErr) {
    console.error(
      "[chat] rate limiter unavailable; continuing without limit:",
      rateLimitErr,
    );
  }

  // --- Parse request body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const chatRequest = parseChatRequest(body);
  if (!chatRequest) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid request. Expected { message: string; history?: Array<{ role, content }> }",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // --- Build message array ---
  const messages: AiMessage[] = [];

  if (chatRequest.skipSystemPrompt) {
    // A/B mode: combine override (if any) with skill content (if any).
    const overridePart = chatRequest.systemPromptOverride ?? "";
    const skillPart =
      chatRequest.skillIds && chatRequest.skillIds.length > 0
        ? getSkillContents(chatRequest.skillIds)
        : "";

    const combined = [overridePart, skillPart].filter(Boolean).join("\n\n");
    if (combined) {
      messages.push({ role: "system", content: combined });
    }
  } else {
    let systemPrompt: string;
    try {
      systemPrompt = await getSystemPrompt();
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to generate system prompt." }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Inject selected skills into the system prompt.
    if (chatRequest.skillIds && chatRequest.skillIds.length > 0) {
      const skillContent = getSkillContents(chatRequest.skillIds);
      if (skillContent) {
        systemPrompt += `\n\n# Additional Design Skills\n\nThe following design skills should heavily influence your output. Apply their principles when generating UI:\n\n${skillContent}`;
      }
    }

    if (chatRequest.systemPromptSupplement) {
      systemPrompt += `\n\n${chatRequest.systemPromptSupplement}`;
    }

    messages.push({ role: "system", content: systemPrompt });
  }

  // Append conversation history (most recent turns).
  const MAX_HISTORY_TURNS = 20;
  if (chatRequest.history) {
    const recentHistory = chatRequest.history.slice(-MAX_HISTORY_TURNS);
    for (const entry of recentHistory) {
      if (entry.role === "user" || entry.role === "assistant") {
        messages.push({ role: entry.role, content: entry.content });
      }
    }
  }

  // Append current user message, enriched with current tree state for follow-ups.
  const userContent = chatRequest.currentUITree
    ? `<current-ui>\n${chatRequest.currentUITree}\n</current-ui>\n\n${chatRequest.message}`
    : chatRequest.message;
  messages.push({ role: "user", content: userContent });

  // --- Aggregate token budget check (user + history only; system prompt is server-controlled) ---
  const userChars = messages.reduce(
    (sum, m) => (m.role === "system" ? sum : sum + m.content.length),
    0,
  );
  if (userChars > MAX_TOTAL_MESSAGE_CHARS) {
    return new Response(
      JSON.stringify({
        error: "Conversation too long. Please start a new chat.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // --- Resolve model ---
  // Accepts both short names ("gemma-3-27b-it") and full Workers AI IDs
  // ("@cf/google/gemma-3-27b-it").
  let resolvedModelId = DEFAULT_MODEL_ID;
  let resolvedModelConfig: ModelConfig | undefined;
  if (chatRequest.model) {
    // Try short name first, then full ID
    const configByShort = MODEL_CONFIGS.get(chatRequest.model);
    const shortByFull = FULL_ID_TO_SHORT.get(chatRequest.model);
    const configByFull = shortByFull
      ? MODEL_CONFIGS.get(shortByFull)
      : undefined;
    const config = configByShort ?? configByFull;
    if (!config) {
      return new Response(
        JSON.stringify({
          error: `Unknown model "${chatRequest.model}". Allowed: ${[...ALLOWED_MODELS.keys()].join(", ")}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    resolvedModelId = config.fullId;
    resolvedModelConfig = config;
  }

  // --- Stream from Workers AI ---
  try {
    const maxTokens = resolvedModelConfig?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const extraParams = resolvedModelConfig?.extraParams ?? {};

    const stream = await runAiWithGatewayFallback({
      ai: env.AI,
      modelId: resolvedModelId,
      body: {
        messages,
        stream: true,
        max_tokens: maxTokens,
        temperature: 0,
        ...extraParams,
      },
      useGateway: !import.meta.env.DEV,
    });

    // Workers AI returns a ReadableStream in SSE format when stream: true
    if (stream instanceof ReadableStream) {
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming fallback (shouldn't happen with stream: true)
    const result = stream as Record<string, unknown>;
    const text = typeof result.response === "string" ? result.response : "";
    const encoder = new TextEncoder();
    const fallbackStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ response: text })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(fallbackStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat] AI error:", err);

    if (import.meta.env.DEV) {
      const upstreamResponse = await proxyDevChatRequest(request, chatRequest);
      if (upstreamResponse !== null) {
        return upstreamResponse;
      }

      return new Response(
        JSON.stringify({
          error:
            "AI unavailable in local astro dev. Run `wrangler dev` on :8787 or set `DEV_CHAT_UPSTREAM_URL`.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "AI service temporarily unavailable." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
};
