import { describe, it, expect } from "vitest";
import {
  createJsonlParser,
  repairTruncatedJson,
} from "@/streaming/jsonl-parser";
import type { JsonPatchOp } from "@/streaming/rfc6902";

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

// =============================================================================
// repairTruncatedJson
// =============================================================================

describe("repairTruncatedJson", () => {
  it("returns null for empty input", () => {
    expect(repairTruncatedJson("")).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(repairTruncatedJson("hello")).toBeNull();
    expect(repairTruncatedJson("[1,2,3]")).toBeNull();
  });

  it("returns null for already-balanced JSON", () => {
    expect(repairTruncatedJson('{"a":1}')).toBeNull();
  });

  it("closes a single missing brace", () => {
    const result = repairTruncatedJson('{"a":1');
    expect(result).toBe('{"a":1}');
    expect(() => JSON.parse(result!)).not.toThrow();
  });

  it("closes multiple missing braces", () => {
    const result = repairTruncatedJson('{"a":{"b":1');
    expect(result).toBe('{"a":{"b":1}}');
    expect(() => JSON.parse(result!)).not.toThrow();
  });

  it("closes missing brackets and braces in correct order", () => {
    const result = repairTruncatedJson('{"a":[1,2');
    expect(result).toBe('{"a":[1,2]}');
    expect(() => JSON.parse(result!)).not.toThrow();
  });

  it("strips trailing comma before closing", () => {
    const result = repairTruncatedJson('{"a":1,');
    expect(result).toBe('{"a":1}');
    expect(() => JSON.parse(result!)).not.toThrow();
  });

  it("repairs the exact gpt-oss-120b Button truncation pattern", () => {
    // Real truncation observed: missing 2 closing braces at end
    const truncated =
      '{"op":"add","path":"/elements/submit-btn","value":{"key":"submit-btn","type":"Button","props":{"children":"Save preferences","variant":"primary"},"parentKey":"form-stack","action":{"name":"submit_form","params":{"form_type":"notification_preferences"}}';
    const result = repairTruncatedJson(truncated);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.op).toBe("add");
    expect(parsed.path).toBe("/elements/submit-btn");
    expect(parsed.value.type).toBe("Button");
    expect(parsed.value.props.children).toBe("Save preferences");
    expect(parsed.value.action.name).toBe("submit_form");
  });

  it("handles truncation mid-string by closing the string first", () => {
    const truncated =
      '{"op":"add","path":"/elements/x","value":{"key":"x","type":"Button","props":{"children":"Save pref';
    const result = repairTruncatedJson(truncated);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.op).toBe("add");
    expect(parsed.value.props.children).toBe("Save pref");
  });
});

// =============================================================================
// flush: truncated JSON repair integration
// =============================================================================

describe("flush: truncated JSON repair", () => {
  it("recovers a truncated Button element from the buffer", () => {
    const parser = createJsonlParser();

    // Push a complete line followed by a truncated line (no trailing newline)
    const complete = '{"op":"add","path":"/root","value":"card"}\n';
    const truncated =
      '{"op":"add","path":"/elements/btn","value":{"key":"btn","type":"Button","props":{"children":"Submit","variant":"primary"},"parentKey":"stack"}}';
    // Remove last } to simulate truncation
    const truncatedInput = truncated.slice(0, -1);

    const pushOps = parser.push(complete + truncatedInput);
    expect(pushOps).toHaveLength(1);
    expect(pushOps[0]?.path).toBe("/root");

    const flushOps = parser.flush();
    expect(flushOps).toHaveLength(1);
    expect(flushOps[0]?.op).toBe("add");
    expect(flushOps[0]?.path).toBe("/elements/btn");
    expect((flushOps[0]?.value as Record<string, unknown>)["type"]).toBe(
      "Button",
    );
  });
});
