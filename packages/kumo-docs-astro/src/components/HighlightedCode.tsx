/**
 * Client-side syntax-highlighted code block using Shiki.
 *
 * Lazily loads the Shiki highlighter on first render, then caches it
 * for subsequent uses. Uses the same dual-theme approach as the Astro
 * CodeBlock component (github-light + vesper) with data-mode switching.
 */

import { useEffect, useState } from "react";
import type { BundledLanguage } from "shiki";
import type { Highlighter } from "shiki/bundle/web";

// ---------------------------------------------------------------------------
// Singleton highlighter — shared across all component instances
// ---------------------------------------------------------------------------

let highlighterPromise: Promise<Highlighter> | null = null;
let highlighterInstance: Highlighter | null = null;

/**
 * Lazily create a single Shiki highlighter instance with only the
 * languages and themes we need. Subsequent calls return the same promise.
 */
function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) return Promise.resolve(highlighterInstance);
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = import("shiki/bundle/web").then(
    async ({ createHighlighter }) => {
      const instance = await createHighlighter({
        themes: ["github-light", "vesper"],
        langs: ["tsx", "typescript", "json", "markdown", "bash", "css", "html"],
      });
      highlighterInstance = instance;
      return instance;
    },
  );

  return highlighterPromise;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HighlightedCodeProps {
  /** Source code to highlight. */
  readonly code: string;
  /** Language for syntax highlighting. */
  readonly lang?: BundledLanguage;
  /** Additional className on the wrapper div. */
  readonly className?: string;
}

/**
 * Renders syntax-highlighted code using Shiki with the same themes as the
 * docs-site CodeBlock.astro component. Falls back to an unhighlighted `<pre>`
 * while Shiki loads.
 */
export function HighlightedCode({
  code,
  lang = "tsx",
  className,
}: HighlightedCodeProps) {
  const [html, setHtml] = useState<string | null>(null);

  // Highlight whenever code or lang changes
  useEffect(() => {
    let cancelled = false;

    void getHighlighter().then((highlighter) => {
      if (cancelled) return;

      const result = highlighter.codeToHtml(code, {
        lang,
        themes: { light: "github-light", dark: "vesper" },
        defaultColor: false,
      });
      setHtml(result);
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  // While loading, show unhighlighted fallback
  if (html === null) {
    return (
      <pre
        className={[
          "overflow-auto p-4 font-mono text-sm text-kumo-default",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {code}
      </pre>
    );
  }

  return (
    <div
      className={["highlighted-code", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Hook that returns just the highlighted HTML string for custom rendering.
 * Returns `null` while Shiki is loading.
 */
export function useHighlightedHtml(
  code: string,
  lang: BundledLanguage = "tsx",
): string | null {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getHighlighter().then((highlighter) => {
      if (cancelled) return;
      setHtml(
        highlighter.codeToHtml(code, {
          lang,
          themes: { light: "github-light", dark: "vesper" },
          defaultColor: false,
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return html;
}
