import {
  createJsonlParser,
  type JsonPatchOp,
} from "@cloudflare/kumo/streaming";

import { readSSEStream } from "~/lib/read-sse-stream";

export interface StreamJsonlUIOptions {
  readonly body: Record<string, unknown>;
  readonly signal: AbortSignal;
  readonly url?: string;
  readonly onPatches: (patches: readonly JsonPatchOp[]) => void;
  readonly onToken?: (token: string) => void;
}

function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  if (!("error" in body)) {
    return null;
  }

  const value = body.error;
  return typeof value === "string" ? value : null;
}

export async function streamJsonlUI({
  body,
  signal,
  url = "/api/chat",
  onPatches,
  onToken,
}: StreamJsonlUIOptions): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(errorBody) ??
        `Request failed (${String(response.status)})`,
    );
  }

  const parser = createJsonlParser();
  let raw = "";

  await readSSEStream(
    response,
    (token) => {
      if (signal.aborted) {
        return;
      }

      raw += token;
      onToken?.(token);
      const ops = parser.push(token);
      if (ops.length > 0) {
        onPatches(ops);
      }
    },
    signal,
  );

  const remaining = parser.flush();
  if (remaining.length > 0) {
    onPatches(remaining);
  }

  return raw;
}
