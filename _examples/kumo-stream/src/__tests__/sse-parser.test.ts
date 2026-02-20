import { describe, it, expect } from "vitest";

import { createSseParser, parseSseDataLinesJson } from "../core/sse-parser";

describe("createSseParser", () => {
  it("handles LF and chunk-split frame boundaries", () => {
    const frames: string[][] = [];
    const p = createSseParser((dataLines) => frames.push([...dataLines]));

    p.push('data: {"ok":true}\n');
    p.push("\n");

    expect(frames).toEqual([['{"ok":true}']]);
  });

  it("handles CRLF newlines", () => {
    const frames: string[][] = [];
    const p = createSseParser((dataLines) => frames.push([...dataLines]));

    p.push("data: a\r\n\r\n");

    expect(frames).toEqual([["a"]]);
  });

  it("supports multiline data: frames", () => {
    const frames: string[][] = [];
    const p = createSseParser((dataLines) => frames.push([...dataLines]));

    p.push("data: one\n");
    p.push("data: two\n\n");

    expect(frames).toEqual([["one", "two"]]);
  });

  it("flush() terminates the current frame at EOF", () => {
    const frames: string[][] = [];
    const p = createSseParser((dataLines) => frames.push([...dataLines]));

    p.push("data: z");
    p.flush();

    expect(frames).toEqual([["z"]]);
  });

  it("ignores non-data fields", () => {
    const frames: string[][] = [];
    const p = createSseParser((dataLines) => frames.push([...dataLines]));

    p.push("event: x\n");
    p.push("id: 1\n");
    p.push("data: ok\n\n");

    expect(frames).toEqual([["ok"]]);
  });
});

describe("parseSseDataLinesJson", () => {
  it("parses joined-by-\\n JSON when split across lines at whitespace", () => {
    const [payload] = parseSseDataLinesJson(['{"a":1,', '"b":2}']);
    expect(payload).toEqual({ a: 1, b: 2 });
  });

  it("parses joined-by-empty-string JSON when emitters split JSON across lines", () => {
    const [payload] = parseSseDataLinesJson(['{"a":', "1}"]);
    expect(payload).toEqual({ a: 1 });
  });

  it("falls back to parsing each data line independently", () => {
    const payloads = parseSseDataLinesJson(['{"a":1}', '{"b":2}']);
    expect(payloads).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
