/**
 * GET /api/chat/skills — returns available skill metadata.
 *
 * Returns the lightweight metadata (id, name, description) — not
 * the full content — so the playground UI can render checkboxes.
 */
import type { APIRoute } from "astro";
import { SKILL_META } from "~/lib/skills-data.generated";

export const prerender = false;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ skills: SKILL_META }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
