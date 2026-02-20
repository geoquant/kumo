/**
 * URL policy helpers.
 *
 * Safe-by-default: allow only http(s) absolute URLs and relative URLs.
 */

export type UrlSanitizationResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: string };

const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * Sanitize a potentially untrusted URL string.
 *
 * - Allows: relative URLs (no scheme) and absolute http(s)
 * - Blocks: protocol-relative (//...), and all other schemes (javascript:, data:, file:, ...)
 */
export function sanitizeUrl(raw: string): UrlSanitizationResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty" };

  // Avoid scheme-relative URLs which inherit the current page scheme.
  if (trimmed.startsWith("//")) {
    return { ok: false, reason: "protocol-relative" };
  }

  const match = SCHEME_RE.exec(trimmed);
  if (match != null) {
    const scheme = match[0].slice(0, -1).toLowerCase();
    if (scheme === "http" || scheme === "https") {
      return { ok: true, url: trimmed };
    }
    return { ok: false, reason: `disallowed-scheme:${scheme}` };
  }

  // No scheme => treat as relative.
  return { ok: true, url: trimmed };
}
