/**
 * GET /api/chat/prompt — returns the assembled system prompt.
 *
 * Requires a valid X-Playground-Key header. Returns 403 without one.
 * The returned prompt is the exact string that would be sent to Workers AI
 * as the system message in /api/chat.
 */
import type { APIRoute } from "astro";
import { validatePlaygroundKey, getSystemPrompt } from "~/lib/playground";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  // --- Playground authentication (required for this endpoint) ---
  const playgroundKey = request.headers.get("x-playground-key");
  const auth = validatePlaygroundKey(playgroundKey, env.PLAYGROUND_SECRET);

  if (auth !== "authenticated") {
    return new Response(
      JSON.stringify({ error: "Valid X-Playground-Key header required." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  // --- Generate / retrieve cached system prompt ---
  try {
    const prompt = await getSystemPrompt();
    return new Response(JSON.stringify({ prompt }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to generate system prompt." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
