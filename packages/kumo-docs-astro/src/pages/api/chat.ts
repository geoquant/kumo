import type { APIRoute } from "astro";
import { createKumoCatalog, initCatalog } from "@cloudflare/kumo/catalog";

export const prerender = false;

/** Maximum length (in characters) for a single user message. */
const MAX_MESSAGE_LENGTH = 2000;

/** Maximum length (in characters) for each history entry. */
const MAX_HISTORY_ENTRY_LENGTH = 4000;

/**
 * AI Gateway ID — route Workers AI requests through AI Gateway for
 * caching, analytics, and gateway-level rate limiting.
 *
 * Create this gateway in the Cloudflare dashboard under AI → AI Gateway.
 * Cache TTL is set to 1 hour so identical preset prompts are served free.
 */
const AI_GATEWAY_ID = "kumo-docs";

/** Chat request body schema. */
interface ChatRequest {
  message: string;
  history?: Array<{ role: string; content: string }>;
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
  if (obj.message.length > MAX_MESSAGE_LENGTH) {
    return null;
  }

  let history: ChatRequest["history"] | undefined;
  if (Array.isArray(obj.history)) {
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

  return { message: obj.message, history };
}

/**
 * Components included in the system prompt. Pruned to keep token budget
 * manageable — only types that appear in the generative component map and
 * are useful for freeform UI generation.
 */
const PROMPT_COMPONENTS = [
  // Layout
  "Surface",
  "Stack",
  "Cluster",
  "Grid",
  "Div",
  // Content
  "Text",
  "Badge",
  "Banner",
  "Code",
  "ClipboardText",
  // Interactive
  "Button",
  "Input",
  "Textarea",
  "Select",
  "SelectOption",
  "Checkbox",
  "Switch",
  "Tabs",
  "Collapsible",
  "RadioGroup",
  "RadioItem",
  "Field",
  "Label",
  // Data display
  "Table",
  "TableHeader",
  "TableHead",
  "TableBody",
  "TableRow",
  "TableCell",
  "TableFooter",
  "Meter",
  // Navigation
  "Link",
  // Feedback
  "Loader",
  "Empty",
] as const;

/** Cached system prompt — generated once per cold start. */
let systemPromptCache: string | null = null;
let systemPromptPromise: Promise<string> | null = null;

async function getSystemPrompt(): Promise<string> {
  // In dev, rebuild prompt on each request so prompt tweaks are immediately
  // reflected without needing to restart the dev server.
  if (import.meta.env.DEV) {
    const catalog = createKumoCatalog();
    await initCatalog(catalog);
    return catalog.generatePrompt({
      components: [...PROMPT_COMPONENTS],
      maxPropsPerComponent: 8,
    });
  }

  if (systemPromptCache) return systemPromptCache;
  if (systemPromptPromise) return systemPromptPromise;

  systemPromptPromise = (async () => {
    const catalog = createKumoCatalog();
    await initCatalog(catalog);
    const prompt = catalog.generatePrompt({
      components: [...PROMPT_COMPONENTS],
      maxPropsPerComponent: 8,
    });
    systemPromptCache = prompt;
    return prompt;
  })();

  return systemPromptPromise;
}

/**
 * POST /api/chat — SSE streaming endpoint for Kumo generative UI.
 *
 * Accepts: { message: string; history?: Array<{ role, content }> }
 * Returns: text/event-stream with Workers AI text generation output
 *
 * Rate limited: 20 req/min per IP via CHAT_RATE_LIMIT binding.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  // --- Rate limiting ---
  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    "unknown";

  try {
    const { success } = await env.CHAT_RATE_LIMIT.limit({ key: clientIp });
    if (!success) {
      return new Response(
        JSON.stringify({ error: "Rate limited. Try again in a minute." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch {
    // Rate limiter unavailable — allow request through
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

  // Append conversation history (clamp to last 20 turns to avoid token overflow)
  const MAX_HISTORY_TURNS = 20;
  if (chatRequest.history) {
    const recentHistory = chatRequest.history.slice(-MAX_HISTORY_TURNS);
    for (const entry of recentHistory) {
      if (entry.role === "user" || entry.role === "assistant") {
        messages.push({ role: entry.role, content: entry.content });
      }
    }
  }

  // Append current user message
  messages.push({ role: "user", content: chatRequest.message });

  // --- Stream from Workers AI ---
  try {
    const stream = await env.AI.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages,
        stream: true,
        max_tokens: 16384,
      },
      {
        gateway: {
          id: AI_GATEWAY_ID,
          cacheTtl: 3600,
        },
      },
    );

    // Workers AI returns a ReadableStream in SSE format when stream: true
    if (stream instanceof ReadableStream) {
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
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
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Workers AI unavailable";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
