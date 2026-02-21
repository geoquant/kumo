import { describe, it, expect } from "vitest";
import { sanitizeUrl } from "@/streaming/url-policy";

describe("sanitizeUrl", () => {
  it("allows http(s) URLs", () => {
    expect(sanitizeUrl("https://example.com")).toEqual({
      ok: true,
      url: "https://example.com",
    });
    expect(sanitizeUrl(" http://example.com/path ")).toEqual({
      ok: true,
      url: "http://example.com/path",
    });
  });

  it("allows relative URLs", () => {
    expect(sanitizeUrl("/dashboard")).toEqual({ ok: true, url: "/dashboard" });
    expect(sanitizeUrl("./settings")).toEqual({ ok: true, url: "./settings" });
    expect(sanitizeUrl("#section")).toEqual({ ok: true, url: "#section" });
    expect(sanitizeUrl("?q=1")).toEqual({ ok: true, url: "?q=1" });
  });

  it("blocks protocol-relative URLs", () => {
    const res = sanitizeUrl("//example.com");
    expect(res.ok).toBe(false);
  });

  it("blocks non-http schemes", () => {
    expect(sanitizeUrl("javascript:alert(1)").ok).toBe(false);
    expect(sanitizeUrl("data:text/html,hi").ok).toBe(false);
    expect(sanitizeUrl("file:///etc/passwd").ok).toBe(false);
    expect(sanitizeUrl("mailto:test@example.com").ok).toBe(false);
  });
});
