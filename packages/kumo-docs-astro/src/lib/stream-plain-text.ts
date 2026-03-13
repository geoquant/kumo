import { readSSEStream } from "~/lib/read-sse-stream";

export interface StreamPlainTextOptions {
  readonly body: Record<string, unknown>;
  readonly signal: AbortSignal;
  readonly onToken: (token: string) => void;
}

function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("error" in body)) return null;
  const value = body.error;
  return typeof value === "string" ? value : null;
}

/**
 * Thin SSE stream reader that accumulates raw text tokens without JSONL
 * parsing. Suitable for endpoints that return plain prose (e.g. AI prompt
 * editing) rather than structured JSON-patch operations.
 */
export async function streamPlainText({
  body,
  signal,
  onToken,
}: StreamPlainTextOptions): Promise<string> {
  const response = await fetch("/api/chat", {
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

  let result = "";

  await readSSEStream(
    response,
    (token) => {
      if (signal.aborted) return;
      result += token;
      onToken(token);
    },
    signal,
  );

  return result;
}
