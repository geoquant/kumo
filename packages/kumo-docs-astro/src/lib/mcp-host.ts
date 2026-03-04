// ---------------------------------------------------------------------------
// Host-side postMessage handler for MCP UI iframes.
//
// Mirrors the iframe-side protocol defined in kumo-mcp/app/utils/mcp.ts.
// The host (parent frame) receives messages from the iframe and dispatches
// them to callbacks provided by the consumer.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inbound message types (iframe → host)
// ---------------------------------------------------------------------------

/** Message the iframe sends when it's ready to receive render data. */
interface LifecycleReadyMessage {
  type: "ui-lifecycle-iframe-ready";
}

/** Typed message the iframe sends to request a tool call. */
interface IframeToolMessage {
  type: "tool";
  messageId: string;
  payload: { toolName: string; params: Record<string, unknown> };
}

/** Typed message the iframe sends to request a prompt. */
interface IframePromptMessage {
  type: "prompt";
  messageId: string;
  payload: { prompt: string };
}

/** Typed message the iframe sends to open a link. */
interface IframeLinkMessage {
  type: "link";
  messageId: string;
  payload: { url: string };
}

/** Discriminated union of action messages from the iframe. */
type IframeActionMessage =
  | IframeToolMessage
  | IframePromptMessage
  | IframeLinkMessage;

/** The iframe reporting a layout dimension change. */
interface SizeChangeMessage {
  type: "ui-size-change";
  payload: { height: number; width: number };
}

/** Discriminated union of every message the iframe might post. */
type IframeMessage =
  | LifecycleReadyMessage
  | IframeActionMessage
  | SizeChangeMessage;

// ---------------------------------------------------------------------------
// Outbound message types (host ��� iframe)
// ---------------------------------------------------------------------------

/** Render data delivered after the iframe signals readiness. */
interface RenderDataResponse {
  type: "ui-lifecycle-iframe-render-data";
  payload: { renderData?: unknown; error?: unknown };
}

/** Correlated response to an iframe action message. */
interface ActionResponse {
  type: "ui-message-response";
  messageId: string;
  payload: { response?: unknown; error?: unknown };
}

type HostMessage = RenderDataResponse | ActionResponse;

// ---------------------------------------------------------------------------
// Re-exports for consumers
// ---------------------------------------------------------------------------

export type {
  LifecycleReadyMessage,
  IframeToolMessage,
  IframePromptMessage,
  IframeLinkMessage,
  IframeActionMessage,
  SizeChangeMessage,
  IframeMessage,
  RenderDataResponse,
  ActionResponse,
  HostMessage,
};

// ---------------------------------------------------------------------------
// Callback types
// ---------------------------------------------------------------------------

type CallbackResult = unknown | Promise<unknown>;

interface ActionCallbacks {
  onToolCall: (
    toolName: string,
    params: Record<string, unknown>,
  ) => CallbackResult;
  onPrompt?: (prompt: string) => CallbackResult;
  onLink?: (url: string) => CallbackResult;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface IframeMessageHandlerConfig extends ActionCallbacks {
  /** Reference to the <iframe> element to filter messages by source. */
  iframe: HTMLIFrameElement;
  /** Data delivered to the iframe when it signals readiness. */
  renderData: Record<string, unknown>;
  /** Called when the iframe reports a layout dimension change. */
  onResize?: (height: number, width: number) => void;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface IframeMessageHandler {
  /** Remove the window event listener. Call on unmount. */
  cleanup: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Runtime guard: is `value` a non-null object we can safely index? */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

/**
 * Narrow a raw `MessageEvent.data` to an {@link IframeMessage}.
 *
 * Every branch reconstructs a fresh typed object so the compiler checks
 * the return shape — no domain-level `as` assertions appear.
 */
function parseIframeMessage(data: unknown): IframeMessage | undefined {
  if (!isRecord(data) || typeof data["type"] !== "string") return undefined;

  const type = data["type"];

  // -- lifecycle ready -------------------------------------------------------
  if (type === "ui-lifecycle-iframe-ready") {
    return { type: "ui-lifecycle-iframe-ready" };
  }

  // -- size change -----------------------------------------------------------
  if (type === "ui-size-change") {
    const payload = data["payload"];
    if (
      isRecord(payload) &&
      typeof payload["height"] === "number" &&
      typeof payload["width"] === "number"
    ) {
      return {
        type: "ui-size-change",
        payload: { height: payload["height"], width: payload["width"] },
      };
    }
    return undefined;
  }

  // -- action messages (tool / prompt / link) --------------------------------
  if (type !== "tool" && type !== "prompt" && type !== "link") return undefined;

  const messageId = data["messageId"];
  const payload = data["payload"];
  if (typeof messageId !== "string" || !isRecord(payload)) return undefined;

  if (type === "tool") {
    if (
      typeof payload["toolName"] === "string" &&
      isRecord(payload["params"])
    ) {
      return {
        type: "tool",
        messageId,
        payload: { toolName: payload["toolName"], params: payload["params"] },
      };
    }
    return undefined;
  }

  if (type === "prompt" && typeof payload["prompt"] === "string") {
    return {
      type: "prompt",
      messageId,
      payload: { prompt: payload["prompt"] },
    };
  }

  if (type === "link" && typeof payload["url"] === "string") {
    return {
      type: "link",
      messageId,
      payload: { url: payload["url"] },
    };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a `message` event handler that bridges the host ↔ iframe
 * postMessage protocol used by MCP UI.
 *
 * The returned `cleanup` function removes the listener and should be called
 * when the host component unmounts.
 *
 * ## Protocol overview
 *
 * | Iframe sends                       | Host does                                            |
 * | ---------------------------------- | ---------------------------------------------------- |
 * | `ui-lifecycle-iframe-ready`        | Posts `ui-lifecycle-iframe-render-data` with config   |
 * | `tool` / `prompt` / `link`         | Calls callback, replies `ui-message-response`        |
 * | `ui-size-change`                   | Calls `onResize(height, width)`                      |
 */
export function createIframeMessageHandler(
  config: IframeMessageHandlerConfig,
): IframeMessageHandler {
  const { iframe, renderData, onResize } = config;

  function postToIframe(message: HostMessage) {
    iframe.contentWindow?.postMessage(message, "*");
  }

  function handleMessage(event: MessageEvent) {
    // Filter: only handle messages originating from our iframe.
    if (event.source !== iframe.contentWindow) return;

    const msg = parseIframeMessage(event.data);
    if (!msg) return;

    switch (msg.type) {
      // -------------------------------------------------------------------
      // Lifecycle: iframe ready → send render data
      // -------------------------------------------------------------------
      case "ui-lifecycle-iframe-ready": {
        const response: RenderDataResponse = {
          type: "ui-lifecycle-iframe-render-data",
          payload: { renderData },
        };
        postToIframe(response);
        break;
      }

      // -------------------------------------------------------------------
      // Action messages: tool / prompt / link → delegate + respond
      // -------------------------------------------------------------------
      case "tool":
      case "prompt":
      case "link": {
        dispatchAction(msg);
        break;
      }

      // -------------------------------------------------------------------
      // Size change → resize callback
      // -------------------------------------------------------------------
      case "ui-size-change": {
        onResize?.(msg.payload.height, msg.payload.width);
        break;
      }
    }
  }

  /**
   * Dispatch an action message to the appropriate callback and post the
   * correlated response back to the iframe.
   *
   * Uses the discriminated union (`msg.type`) to narrow the payload type
   * without type assertions.
   */
  function dispatchAction(msg: IframeActionMessage) {
    const respond = (result: { response?: unknown; error?: unknown }) => {
      const response: ActionResponse = {
        type: "ui-message-response",
        messageId: msg.messageId,
        payload: result,
      };
      postToIframe(response);
    };

    let resultOrPromise: CallbackResult;

    try {
      switch (msg.type) {
        case "tool": {
          resultOrPromise = config.onToolCall(
            msg.payload.toolName,
            msg.payload.params,
          );
          break;
        }
        case "prompt": {
          if (config.onPrompt) {
            resultOrPromise = config.onPrompt(msg.payload.prompt);
          } else {
            respond({ error: "Prompt handler not configured" });
            return;
          }
          break;
        }
        case "link": {
          if (config.onLink) {
            resultOrPromise = config.onLink(msg.payload.url);
          } else {
            respond({ error: "Link handler not configured" });
            return;
          }
          break;
        }
      }
    } catch (err) {
      respond({ error: err instanceof Error ? err.message : String(err) });
      return;
    }

    // Handle sync and async results uniformly.
    if (resultOrPromise instanceof Promise) {
      resultOrPromise.then(
        (response) => respond({ response }),
        (err) =>
          respond({ error: err instanceof Error ? err.message : String(err) }),
      );
    } else {
      respond({ response: resultOrPromise });
    }
  }

  window.addEventListener("message", handleMessage);

  return {
    cleanup() {
      window.removeEventListener("message", handleMessage);
    },
  };
}
