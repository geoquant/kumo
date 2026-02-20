/**
 * Minimal SSE (Server-Sent Events) parser.
 *
 * Goals:
 * - tolerate CRLF vs LF
 * - tolerate frames split across chunks
 * - support multi-line `data:` frames (joined with "\n" per spec)
 *
 * This parser only surfaces `data:` lines. It ignores `event:`, `id:`, etc.
 */

export interface SseParser {
  /** Feed a decoded UTF-8 text chunk. */
  readonly push: (chunk: string) => void;
  /** Flush remaining buffered content; treats end-of-stream as frame terminator. */
  readonly flush: () => void;
}

export function createSseParser(
  onDataLines: (dataLines: readonly string[]) => void,
): SseParser {
  let lineBuffer = "";
  let dataLines: string[] = [];

  function dispatch(): void {
    if (dataLines.length === 0) return;
    onDataLines(dataLines);
    dataLines = [];
  }

  function handleLine(line: string): void {
    // Empty line terminates the current SSE event.
    if (line === "") {
      dispatch();
      return;
    }

    if (!line.startsWith("data:")) return;

    let value = line.slice(5);
    if (value.startsWith(" ")) value = value.slice(1);
    dataLines.push(value);
  }

  function push(chunk: string): void {
    lineBuffer += chunk;

    while (true) {
      const nl = lineBuffer.indexOf("\n");
      if (nl === -1) return;

      let rawLine = lineBuffer.slice(0, nl);
      lineBuffer = lineBuffer.slice(nl + 1);

      if (rawLine.endsWith("\r")) rawLine = rawLine.slice(0, -1);
      handleLine(rawLine);
    }
  }

  function flush(): void {
    if (lineBuffer.length > 0) {
      let rawLine = lineBuffer;
      lineBuffer = "";
      if (rawLine.endsWith("\r")) rawLine = rawLine.slice(0, -1);
      handleLine(rawLine);
    }

    // Treat end-of-stream as an empty line terminator.
    handleLine("");
  }

  return { push, flush };
}
