import type { APIRoute } from "astro";
import { validatePlaygroundKey, getSystemPrompt } from "~/lib/playground";

export const prerender = false;

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Maximum length (in characters) for a single user message. */
const MAX_MESSAGE_LENGTH = 2000;

/** Maximum length (in characters) for each history entry. */
const MAX_HISTORY_ENTRY_LENGTH = 4000;

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

/**
 * Models available to authenticated playground users.
 * Keys are the short names accepted in the `model` request field;
 * values are the full Workers AI model identifiers.
 */
const ALLOWED_MODELS: ReadonlyMap<string, string> = new Map([
  ["glm-4.7-flash", "@cf/zai-org/glm-4.7-flash"],
  ["llama-4-scout-17b-16e-instruct", "@cf/meta/llama-4-scout-17b-16e-instruct"],
  ["gemma-3-27b-it", "@cf/google/gemma-3-27b-it"],
]);

/** Reverse index: full Workers AI model IDs → short names for lookup. */
const FULL_ID_TO_SHORT = new Map(
  [...ALLOWED_MODELS.entries()].map(([short, full]) => [full, short]),
);

/** Chat request body schema. */
interface ChatRequest {
  message: string;
  history?: Array<{ role: string; content: string }>;
  model?: string;
}

/** Workers AI text-generation message format. */
interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Validate and parse incoming chat request body.
 * Returns parsed request or null if invalid.
 */
function parseChatRequest(body: unknown): ChatRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.message !== "string" || obj.message.trim().length === 0) {
    return null;
  }
  const message = obj.message.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return null;
  }

  let history: ChatRequest["history"] | undefined;
  if (Array.isArray(obj.history)) {
    if (obj.history.length > MAX_HISTORY_ENTRIES) return null;
    const valid = obj.history.every(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).role === "string" &&
        typeof (entry as Record<string, unknown>).content === "string" &&
        ((entry as Record<string, unknown>).content as string).length <=
          MAX_HISTORY_ENTRY_LENGTH,
    );
    if (!valid) return null;
    history = obj.history as ChatRequest["history"];
  }

  // Model is validated downstream (only used for authenticated users).
  const model = typeof obj.model === "string" ? obj.model.trim() : undefined;

  return { message, history, model: model || undefined };
}

/**
 * POST /api/chat — SSE streaming endpoint for Kumo generative UI.
 *
 * Accepts: { message: string; history?: Array<{ role, content }> }
 * Returns: text/event-stream with Workers AI text generation output
 *
 * Rate limited: 20 req/min (anonymous) or 100/min (valid X-Playground-Key).
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  // --- Playground authentication ---
  const playgroundKey = request.headers.get("x-playground-key");
  const auth = validatePlaygroundKey(playgroundKey, env.PLAYGROUND_SECRET);

  if (auth === "invalid") {
    return new Response(JSON.stringify({ error: "Invalid playground key." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Rate limiting ---
  // Authenticated playground users get a relaxed 100 req/min limit;
  // anonymous users get the standard 20 req/min limit.
  const rateLimiter =
    auth === "authenticated" ? env.PLAYGROUND_RATE_LIMIT : env.CHAT_RATE_LIMIT;
  const clientIp = request.headers.get("cf-connecting-ip");

  try {
    // In dev/preview, this header is often missing; avoid collapsing
    // all users into a single "unknown" rate-limit bucket.
    if (clientIp) {
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
    }
  } catch (rateLimitErr) {
    console.error("[chat] rate limiter unavailable:", rateLimitErr);
    if (!import.meta.env.DEV) {
      return new Response(
        JSON.stringify({ error: "Rate limiting unavailable. Try again." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
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
  let systemPrompt: string;
  try {
    systemPrompt = await getSystemPrompt();
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to generate system prompt." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const messages: AiMessage[] = [{ role: "system", content: systemPrompt }];

  // Append conversation history only for authenticated playground users.
  // Without a valid key, history is silently ignored — the request degrades
  // to a single-turn prompt, preserving backward compatibility.
  const MAX_HISTORY_TURNS = 20;
  if (auth === "authenticated" && chatRequest.history) {
    const recentHistory = chatRequest.history.slice(-MAX_HISTORY_TURNS);
    for (const entry of recentHistory) {
      if (entry.role === "user" || entry.role === "assistant") {
        messages.push({ role: entry.role, content: entry.content });
      }
    }
  }

  // Append current user message
  messages.push({ role: "user", content: chatRequest.message });

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
  // Authenticated playground users may select a model from the allowlist.
  // Accepts both short names ("gemma-3-27b-it") and full Workers AI IDs
  // ("@cf/google/gemma-3-27b-it"). Without a valid key, the model field
  // is silently ignored.
  let resolvedModelId = DEFAULT_MODEL_ID;
  if (auth === "authenticated" && chatRequest.model) {
    const byShort = ALLOWED_MODELS.get(chatRequest.model);
    const byFull = FULL_ID_TO_SHORT.has(chatRequest.model)
      ? chatRequest.model
      : undefined;
    const fullId = byShort ?? byFull;
    if (!fullId) {
      return new Response(
        JSON.stringify({
          error: `Unknown model "${chatRequest.model}". Allowed: ${[...ALLOWED_MODELS.keys()].join(", ")}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    resolvedModelId = fullId;
  }

  // --- Stream from Workers AI ---
  try {
    const aiOptions = import.meta.env.DEV
      ? undefined
      : {
          gateway: {
            id: AI_GATEWAY_ID,
            cacheTtl: 0,
          },
        };

    const stream = await env.AI.run(
      resolvedModelId,
      {
        messages,
        stream: true,
        max_tokens: 4096,
        temperature: 0,
      },
      aiOptions,
    );

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
    return new Response(
      JSON.stringify({ error: "AI service temporarily unavailable." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
};
