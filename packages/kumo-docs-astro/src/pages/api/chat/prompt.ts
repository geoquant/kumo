/**
 * GET /api/chat/prompt — returns the assembled system prompt.
 *
 * The returned prompt is the exact string that would be sent to Workers AI
 * as the system message in /api/chat.
 */
import type { APIRoute } from "astro";
import { getSystemPrompt } from "~/lib/playground";

export const prerender = false;

export const GET: APIRoute = async () => {
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
