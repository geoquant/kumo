/**
 * GET /api/chat/skills — returns available skill metadata.
 *
 * Requires a valid X-Playground-Key header. Returns 403 without one.
 * Returns the lightweight metadata (id, name, description) — not
 * the full content — so the playground UI can render checkboxes.
 */
import type { APIRoute } from "astro";
import { validatePlaygroundKey } from "~/lib/playground";
import { SKILL_META } from "~/lib/skills-data.generated";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  const playgroundKey = request.headers.get("x-playground-key");
  const auth = validatePlaygroundKey(playgroundKey, env.PLAYGROUND_SECRET);

  if (auth !== "authenticated") {
    return new Response(
      JSON.stringify({ error: "Valid X-Playground-Key header required." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ skills: SKILL_META }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
