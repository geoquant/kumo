/**
 * Shared playground utilities used by /api/chat and /api/chat/prompt.
 *
 * Extracted to avoid duplicating authentication logic and system prompt
 * generation across API endpoints.
 */
import {
  createKumoCatalog,
  initCatalog,
  type CustomComponentDefinition,
} from "@cloudflare/kumo/catalog";

// ---------------------------------------------------------------------------
// Playground authentication
// ---------------------------------------------------------------------------

/**
 * Playground auth state derived from the X-Playground-Key header.
 *
 * - `authenticated`: valid key, playground features enabled, relaxed rate limit
 * - `unauthenticated`: no key sent, regular anonymous user
 * - `invalid`: key sent but doesn't match PLAYGROUND_SECRET → 403
 */
export type PlaygroundAuth = "authenticated" | "unauthenticated" | "invalid";

/**
 * Validate the X-Playground-Key header against the PLAYGROUND_SECRET env var.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validatePlaygroundKey(
  header: string | null,
  secret: string | undefined,
): PlaygroundAuth {
  if (!header) return "unauthenticated";
  if (!secret) return "invalid";

  const encoder = new TextEncoder();
  const a = encoder.encode(header);
  const b = encoder.encode(secret);

  if (a.byteLength !== b.byteLength) return "invalid";

  // Constant-time byte comparison — XOR accumulator over raw buffers
  // prevents early-exit timing leaks.
  const viewA = new DataView(a.buffer, a.byteOffset, a.byteLength);
  const viewB = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= viewA.getUint8(i) ^ viewB.getUint8(i);
  }
  return diff === 0 ? "authenticated" : "invalid";
}

// ---------------------------------------------------------------------------
// System prompt generation
// ---------------------------------------------------------------------------

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

/**
 * Custom component metadata for prompt generation. The actual React component
 * lives in the client bundle (DemoButton.tsx); here we only need the metadata
 * so the LLM knows the type exists and what props it accepts.
 *
 * Using a no-op stub for `component` since the server never renders it.
 */
const CUSTOM_COMPONENTS: Readonly<Record<string, CustomComponentDefinition>> = {
  DemoButton: {
    component: "span",
    description: "A fancy button with a rainbow conic-gradient hover effect",
    props: {
      children: { type: "string", description: "Button label text" },
      variant: {
        type: "string",
        description: "Visual variant",
        values: ["light", "dark"],
        default: "light",
        optional: true,
      },
    },
  },
};

/** Cached system prompt ��� generated once per cold start. */
let systemPromptCache: string | null = null;
let systemPromptPromise: Promise<string> | null = null;

/**
 * Generate and cache the system prompt used for Workers AI requests.
 * In dev mode, rebuilds on every call for fast iteration.
 */
export async function getSystemPrompt(): Promise<string> {
  // In dev, rebuild prompt on each request so prompt tweaks are immediately
  // reflected without needing to restart the dev server.
  if (import.meta.env.DEV) {
    const catalog = createKumoCatalog({ customComponents: CUSTOM_COMPONENTS });
    await initCatalog(catalog);
    return catalog.generatePrompt({
      components: [...PROMPT_COMPONENTS],
      maxPropsPerComponent: 8,
    });
  }

  if (systemPromptCache) return systemPromptCache;
  if (systemPromptPromise) return systemPromptPromise;

  systemPromptPromise = (async () => {
    try {
      const catalog = createKumoCatalog({
        customComponents: CUSTOM_COMPONENTS,
      });
      await initCatalog(catalog);
      const prompt = catalog.generatePrompt({
        components: [...PROMPT_COMPONENTS],
        maxPropsPerComponent: 8,
      });
      systemPromptCache = prompt;
      return prompt;
    } catch (err) {
      // Clear promise so next request retries instead of caching the rejection.
      systemPromptPromise = null;
      throw err;
    }
  })();

  return systemPromptPromise;
}
