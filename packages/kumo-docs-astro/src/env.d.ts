/// <reference types="astro/client" />

/**
 * Cloudflare bindings available via Astro.locals.runtime.env
 * See wrangler.jsonc for binding configuration.
 *
 * Minimal type definitions for Workers AI and Rate Limiting bindings.
 * Full types available via `@cloudflare/workers-types` if installed.
 */

/** Workers AI binding — subset of methods used by the docs chat endpoint. */
interface WorkersAi {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: {
      gateway?: {
        id: string;
        /** Cache TTL in seconds. Identical requests served from cache at zero cost. */
        cacheTtl?: number;
        /** Skip cache for this request. */
        skipCache?: boolean;
      };
    },
  ): Promise<ReadableStream | Record<string, unknown>>;
}

/** Rate Limiting binding — see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ */
interface WorkersRateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

type KumoDocsEnv = {
  AI: WorkersAi;
  CHAT_RATE_LIMIT: WorkersRateLimit;
};

type Runtime = import("@astrojs/cloudflare").Runtime<KumoDocsEnv>;

declare namespace App {
  interface Locals extends Runtime {}
}
