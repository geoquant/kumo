import { describe, it, expect } from "vitest";
import { createJsonlParser } from "../core/jsonl-parser";
import type { JsonPatchOp } from "../core/rfc6902";

// =============================================================================
// Helpers
// =============================================================================

function op(
  opType: "add" | "replace" | "remove",
  path: string,
  value?: unknown,
): JsonPatchOp {
  return value !== undefined
    ? { op: opType, path, value }
    : { op: opType, path };
}

function line(patch: JsonPatchOp): string {
  return JSON.stringify(patch);
}

// =============================================================================
// push: single complete line
// =============================================================================

describe("push: single complete line", () => {
  it("returns one JsonPatchOp for a single line ending in newline", () => {
    const parser = createJsonlParser();
    const patch = op("add", "/root", "card-1");
    const result = parser.push(line(patch) + "\n");
    expect(result).toEqual([patch]);
  });

  it("returns a correctly typed patch op", () => {
    const parser = createJsonlParser();
    const patch = op("add", "/elements/card-1", {
      key: "card-1",
      type: "Surface",
      props: {},
    });
    const result = parser.push(line(patch) + "\n");
    expect(result).toHaveLength(1);
    expect(result[0]?.op).toBe("add");
    expect(result[0]?.path).toBe("/elements/card-1");
  });
});

// =============================================================================
// push: multiple lines in one chunk
// =============================================================================

describe("push: multiple lines in one chunk", () => {
  it("returns multiple JsonPatchOps for multiple lines", () => {
    const parser = createJsonlParser();
    const p1 = op("add", "/root", "card-1");
    const p2 = op("add", "/elements/card-1", {
      key: "card-1",
      type: "Surface",
      props: {},
    });
    const chunk = line(p1) + "\n" + line(p2) + "\n";
    const result = parser.push(chunk);
    expect(result).toEqual([p1, p2]);
  });

  it("handles three lines in one chunk", () => {
    const parser = createJsonlParser();
    const p1 = op("add", "/root", "a");
    const p2 = op("add", "/elements/b", { key: "b", type: "Text", props: {} });
    const p3 = op("remove", "/elements/c");
    const chunk = [line(p1), line(p2), line(p3), ""].join("\n");
    const result = parser.push(chunk);
    expect(result).toEqual([p1, p2, p3]);
  });
});

// =============================================================================
// push: line split across chunks
// =============================================================================

describe("push: line split across chunks", () => {
  it("buffers partial line then returns parsed on completing chunk", () => {
    const parser = createJsonlParser();
    const patch = op("add", "/root", "card-1");
    const full = line(patch);
    const mid = Math.floor(full.length / 2);

    // First chunk — no newline, should buffer
    const r1 = parser.push(full.slice(0, mid));
    expect(r1).toEqual([]);

    // Second chunk — rest + newline, should return parsed
    const r2 = parser.push(full.slice(mid) + "\n");
    expect(r2).toEqual([patch]);
  });

  it("buffers across three chunks", () => {
    const parser = createJsonlParser();
    const patch = op("replace", "/elements/x", {
      key: "x",
      type: "Badge",
      props: { label: "hi" },
    });
    const full = line(patch);
    const a = full.slice(0, 5);
    const b = full.slice(5, 15);
    const c = full.slice(15) + "\n";

    expect(parser.push(a)).toEqual([]);
    expect(parser.push(b)).toEqual([]);
    expect(parser.push(c)).toEqual([patch]);
  });
});

// =============================================================================
// push: empty lines skipped
// =============================================================================

describe("push: empty lines", () => {
  it("skips empty lines between valid lines", () => {
    const parser = createJsonlParser();
    const p1 = op("add", "/root", "a");
    const p2 = op("add", "/elements/b", { key: "b", type: "Text", props: {} });
    const chunk = line(p1) + "\n\n\n" + line(p2) + "\n";
    const result = parser.push(chunk);
    expect(result).toEqual([p1, p2]);
  });

  it("skips whitespace-only lines", () => {
    const parser = createJsonlParser();
    const p1 = op("add", "/root", "a");
    const chunk = line(p1) + "\n   \n  \n";
    const result = parser.push(chunk);
    expect(result).toEqual([p1]);
  });
});

// =============================================================================
// push: invalid JSON skipped
// =============================================================================

describe("push: invalid JSON", () => {
  it("silently skips invalid JSON lines", () => {
    const parser = createJsonlParser();
    const valid = op("add", "/root", "card-1");
    const chunk = "this is not json\n" + line(valid) + "\n";
    const result = parser.push(chunk);
    expect(result).toEqual([valid]);
  });

  it("skips lines missing op field", () => {
    const parser = createJsonlParser();
    const valid = op("add", "/root", "card-1");
    const chunk = '{"path":"/root","value":"x"}\n' + line(valid) + "\n";
    const result = parser.push(chunk);
    expect(result).toEqual([valid]);
  });

  it("skips lines with unsupported op types", () => {
    const parser = createJsonlParser();
    const valid = op("add", "/root", "card-1");
    const chunk =
      '{"op":"move","path":"/root","from":"/root"}\n' + line(valid) + "\n";
    const result = parser.push(chunk);
    expect(result).toEqual([valid]);
  });
});

// =============================================================================
// push: markdown fences skipped
// =============================================================================

describe("push: markdown fences", () => {
  it("skips lines starting with triple backticks", () => {
    const parser = createJsonlParser();
    const valid = op("add", "/root", "card-1");
    const chunk = "```json\n" + line(valid) + "\n```\n";
    const result = parser.push(chunk);
    expect(result).toEqual([valid]);
  });

  it("skips bare triple backticks", () => {
    const parser = createJsonlParser();
    const valid = op("add", "/root", "x");
    const chunk = "```\n" + line(valid) + "\n```\n";
    const result = parser.push(chunk);
    expect(result).toEqual([valid]);
  });

  it("skips indented markdown fences", () => {
    const parser = createJsonlParser();
    const valid = op("add", "/root", "x");
    const chunk = "  ```json\n" + line(valid) + "\n  ```\n";
    const result = parser.push(chunk);
    expect(result).toEqual([valid]);
  });
});

// =============================================================================
// flush: returns buffered incomplete line
// =============================================================================

describe("flush", () => {
  it("returns parsed op for buffered incomplete line", () => {
    const parser = createJsonlParser();
    const patch = op("add", "/root", "card-1");

    // Push without trailing newline — stays in buffer
    parser.push(line(patch));
    const result = parser.flush();
    expect(result).toEqual([patch]);
  });

  it("returns empty array if buffer is empty", () => {
    const parser = createJsonlParser();
    expect(parser.flush()).toEqual([]);
  });

  it("returns empty array if buffer contains only whitespace", () => {
    const parser = createJsonlParser();
    parser.push("   ");
    expect(parser.flush()).toEqual([]);
  });

  it("returns empty array if buffer contains invalid JSON", () => {
    const parser = createJsonlParser();
    parser.push("not json at all");
    expect(parser.flush()).toEqual([]);
  });

  it("returns empty array if buffer contains a markdown fence", () => {
    const parser = createJsonlParser();
    parser.push("```");
    expect(parser.flush()).toEqual([]);
  });

  it("clears buffer after flush", () => {
    const parser = createJsonlParser();
    const patch = op("add", "/root", "card-1");
    parser.push(line(patch));
    parser.flush();
    // Second flush should return nothing
    expect(parser.flush()).toEqual([]);
  });
});

// =============================================================================
// Combined: push + flush workflow
// =============================================================================

describe("push + flush workflow", () => {
  it("handles a complete streaming session", () => {
    const parser = createJsonlParser();
    const patches = [
      op("add", "/root", "page"),
      op("add", "/elements/page", {
        key: "page",
        type: "Surface",
        props: {},
        children: ["heading"],
      }),
      op("add", "/elements/heading", {
        key: "heading",
        type: "Text",
        props: { content: "Hello" },
      }),
    ];

    // Simulate token-by-token streaming with line breaks at arbitrary points
    const full = patches.map(line).join("\n") + "\n";
    const allOps: JsonPatchOp[] = [];

    // Stream in 10-char chunks
    for (let i = 0; i < full.length; i += 10) {
      const chunk = full.slice(i, i + 10);
      allOps.push(...parser.push(chunk));
    }
    allOps.push(...parser.flush());

    expect(allOps).toEqual(patches);
  });
});
