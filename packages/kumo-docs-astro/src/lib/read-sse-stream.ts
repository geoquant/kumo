/**
 * SSE stream reader for Workers AI and OpenAI-compatible endpoints.
 *
 * Wire format: `data: {"response":"...token..."}\n\n` ending with `data: [DONE]\n\n`
 *
 * Supports:
 * - Workers AI legacy: `{ response: "..." }`
 * - OpenAI-compatible: `{ choices: [{ delta: { content: "..." } }] }`
 * - Plain-text SSE data lines (fallback)
 */
export async function readSSEStream(
  response: Response,
  onToken: (token: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const body = response.body;
  if (!body) throw new Error("No response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;

  let pendingDataLines: string[] = [];

  function emitFromDataPayload(payload: string): void {
    const trimmed = payload.trim();
    if (trimmed === "") return;
    if (trimmed === "[DONE]") return;

    function emitToken(value: unknown): boolean {
      if (typeof value === "string") {
        if (value === "") return false;
        onToken(value);
        return true;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        onToken(String(value));
        return true;
      }
      return false;
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null) return;
      const obj = parsed as Record<string, unknown>;

      // Workers AI legacy format: { response: "..." }
      if ("response" in obj) {
        if (emitToken(obj.response)) return;
      }

      // OpenAI-compatible streaming format.
      // Common shapes:
      // - { choices: [{ delta: { content: "..." } }] }
      // - { choices: [{ delta: { text: "..." } }] }
      // - { choices: [{ text: "..." }] }
      if ("choices" in obj && Array.isArray(obj.choices)) {
        const choice = obj.choices[0] as Record<string, unknown> | undefined;
        if (!choice) return;

        if ("text" in choice && emitToken(choice.text)) return;

        if (typeof choice.delta === "object" && choice.delta) {
          const delta = choice.delta as Record<string, unknown>;

          if ("content" in delta && emitToken(delta.content)) return;
          if ("text" in delta && emitToken(delta.text)) return;
        }
      }
    } catch {
      // Some providers stream plain text tokens over SSE: `data: <token>`.
      // Treat unparseable payloads as raw token text.
      onToken(payload);
    }
  }

  function maybeEmitPendingBlock(): void {
    if (pendingDataLines.length === 0) return;
    const combined = pendingDataLines.join("\n");
    const trimmed = combined.trim();

    // Terminator event.
    if (trimmed === "[DONE]") {
      pendingDataLines = [];
      sawDone = true;
      return;
    }

    // If the block is parseable JSON, emit it. This handles both single-line
    // events and multi-line `data:` events (SSE spec) without requiring `\n\n`.
    try {
      JSON.parse(trimmed);
      emitFromDataPayload(combined);
      pendingDataLines = [];
      return;
    } catch {
      // If the first line doesn't look like JSON, treat it as a raw token.
      // Many providers stream `data: <token>` (plain text) per line.
      if (
        pendingDataLines.length === 1 &&
        !trimmed.startsWith("{") &&
        !trimmed.startsWith("[")
      ) {
        onToken(combined);
        pendingDataLines = [];
      }
    }
  }

  function processLine(rawLine: string): void {
    const line = rawLine.replace(/\r/g, "");
    if (line.trim() === "") {
      // Blank line ends an SSE event block.
      maybeEmitPendingBlock();
      return;
    }
    if (line.startsWith(":")) return; // SSE comment
    if (!line.startsWith("data:")) return;

    const payload = line.slice("data:".length).trimStart();
    pendingDataLines.push(payload);
    // Progress even when intermediaries omit the blank-line delimiter.
    maybeEmitPendingBlock();
  }

  try {
    for (;;) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse incrementally by lines.
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline === -1) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        processLine(line);
        if (sawDone) return;
      }
    }

    // Best-effort flush for streams that don't end with a newline.
    if (buffer.length > 0) processLine(buffer);
    maybeEmitPendingBlock();
    if (sawDone) return;
  } finally {
    reader.releaseLock();
  }
}
