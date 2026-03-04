import { type z } from "zod";

// ---------------------------------------------------------------------------
// Outbound message types (iframe → host)
// ---------------------------------------------------------------------------

/** Payload shapes keyed by message type. */
type McpMessagePayloads = {
  tool: { toolName: string; params: Record<string, unknown> };
  prompt: { prompt: string };
  link: { url: string };
};

type McpMessageType = keyof McpMessagePayloads;

/** Wire format for outbound messages. */
interface OutboundMessage<T extends McpMessageType = McpMessageType> {
  type: T;
  messageId: string;
  payload: McpMessagePayloads[T];
}

// ---------------------------------------------------------------------------
// Inbound message types (host → iframe)
// ---------------------------------------------------------------------------

/** Host response to a correlated outbound message. */
interface InboundMessageResponse {
  type: "ui-message-response";
  messageId: string;
  payload: { response?: unknown; error?: unknown };
}

/** Host sends render data after iframe signals ready. */
interface InboundRenderData {
  type: "ui-lifecycle-iframe-render-data";
  payload: { renderData?: unknown; error?: unknown };
}

/** Discriminated union of all inbound message shapes. */
type InboundMessage = InboundMessageResponse | InboundRenderData;

// ---------------------------------------------------------------------------
// Outbound lifecycle messages
// ---------------------------------------------------------------------------

/** Signals the host that the iframe is ready to receive render data. */
interface LifecycleReadyMessage {
  type: "ui-lifecycle-iframe-ready";
}

/** Reports iframe dimensions to the host. */
interface SizeChangeMessage {
  type: "ui-size-change";
  payload: { height: number; width: number };
}

// ---------------------------------------------------------------------------
// Re-exports for consumers who need the types
// ---------------------------------------------------------------------------

export type {
  McpMessagePayloads,
  McpMessageType,
  OutboundMessage,
  InboundMessageResponse,
  InboundRenderData,
  InboundMessage,
  LifecycleReadyMessage,
  SizeChangeMessage,
};

// ---------------------------------------------------------------------------
// sendMcpMessage — typed, messageId-correlated, Zod-validated responses
// ---------------------------------------------------------------------------

interface SendOptions<S extends z.ZodSchema | undefined = undefined> {
  schema?: S;
  /** Timeout in ms. Defaults to 30 000. */
  timeoutMs?: number;
}

/** Return type narrows to `z.infer<S>` when a schema is provided. */
type SendResult<S extends z.ZodSchema | undefined> = S extends z.ZodSchema
  ? z.infer<S>
  : unknown;

// Overloads for each message type ensure payload is correctly typed at call site.

function sendMcpMessage<S extends z.ZodSchema | undefined = undefined>(
  type: "tool",
  payload: McpMessagePayloads["tool"],
  options?: SendOptions<S>,
): Promise<SendResult<S>>;

function sendMcpMessage<S extends z.ZodSchema | undefined = undefined>(
  type: "prompt",
  payload: McpMessagePayloads["prompt"],
  options?: SendOptions<S>,
): Promise<SendResult<S>>;

function sendMcpMessage<S extends z.ZodSchema | undefined = undefined>(
  type: "link",
  payload: McpMessagePayloads["link"],
  options?: SendOptions<S>,
): Promise<SendResult<S>>;

/**
 * Post a typed message to the host frame and wait for a correlated response.
 *
 * The host is expected to reply with `{ type: "ui-message-response", messageId, payload }`.
 * If a Zod `schema` is provided the response is validated before resolving.
 */
function sendMcpMessage(
  type: McpMessageType,
  payload: McpMessagePayloads[McpMessageType],
  options: SendOptions<z.ZodSchema | undefined> = {},
): Promise<unknown> {
  const { schema, timeoutMs = 30_000 } = options;
  const messageId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    if (!window.parent || window.parent === window) {
      reject(new Error("No parent frame available"));
      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function cleanup() {
      window.removeEventListener("message", handleMessage);
      if (timer !== undefined) clearTimeout(timer);
    }

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    }

    function handleMessage(event: MessageEvent<InboundMessageResponse>) {
      if (event.data?.type !== "ui-message-response") return;
      if (event.data.messageId !== messageId) return;

      const { response, error } = event.data.payload;

      if (error) {
        settle(() => reject(error));
        return;
      }

      if (!schema) {
        settle(() => resolve(response));
        return;
      }

      const parseResult = schema.safeParse(response);
      if (!parseResult.success) {
        settle(() => reject(parseResult.error));
        return;
      }

      settle(() => resolve(parseResult.data));
    }

    window.addEventListener("message", handleMessage);

    const outbound: OutboundMessage = { type, messageId, payload };
    window.parent.postMessage(outbound, "*");

    timer = setTimeout(() => {
      settle(() =>
        reject(
          new Error(`sendMcpMessage("${type}") timed out after ${timeoutMs}ms`),
        ),
      );
    }, timeoutMs);
  });
}

export { sendMcpMessage };

// ---------------------------------------------------------------------------
// waitForRenderData — lifecycle: ready signal → receive render data → parse
// ---------------------------------------------------------------------------

interface WaitOptions {
  /** Timeout in ms. Defaults to 10 000. */
  timeoutMs?: number;
}

/**
 * Signal iframe readiness and wait for the host to deliver render data.
 *
 * Flow:
 *  1. Posts `{ type: "ui-lifecycle-iframe-ready" }` to the host.
 *  2. Listens for `{ type: "ui-lifecycle-iframe-render-data", payload }`.
 *  3. Validates `payload.renderData` against the provided Zod schema.
 *  4. Resolves with the parsed data.
 */
export function waitForRenderData<RenderData>(
  schema: z.ZodSchema<RenderData>,
  options: WaitOptions = {},
): Promise<RenderData> {
  const { timeoutMs = 10_000 } = options;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function cleanup() {
      window.removeEventListener("message", handleMessage);
      if (timer !== undefined) clearTimeout(timer);
    }

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    }

    function handleMessage(event: MessageEvent<InboundRenderData>) {
      if (event.data?.type !== "ui-lifecycle-iframe-render-data") return;

      const { renderData, error } = event.data.payload;

      if (error) {
        settle(() => reject(error));
        return;
      }

      const parseResult = schema.safeParse(renderData);
      if (!parseResult.success) {
        settle(() => reject(parseResult.error));
        return;
      }

      settle(() => resolve(parseResult.data));
    }

    window.addEventListener("message", handleMessage);

    // Signal readiness — host replies with render data.
    const ready: LifecycleReadyMessage = { type: "ui-lifecycle-iframe-ready" };
    window.parent.postMessage(ready, "*");

    timer = setTimeout(() => {
      settle(() =>
        reject(new Error(`waitForRenderData timed out after ${timeoutMs}ms`)),
      );
    }, timeoutMs);
  });
}
