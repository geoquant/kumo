import { useMemo, useState } from "react";
import { Button, Input, Text, cn } from "@cloudflare/kumo";
import {
  CloudflareIcon,
  cloudflareIconNames,
  type CloudflareIconName,
} from "@cloudflare/kumo/components/cloudflare-icon";

const FEATURED_GLYPHS: CloudflareIconName[] = [
  "cloud-internet-outline",
  "cloud-internet-solid",
];

export function CloudflareIconBasicDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {FEATURED_GLYPHS.map((glyph) => (
        <div
          key={glyph}
          className="flex items-center gap-3 rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3"
        >
          <CloudflareIcon glyph={glyph} size="lg" />
          <Text size="sm" bold>
            {glyph}
          </Text>
        </div>
      ))}
    </div>
  );
}

export function CloudflareIconSizesDemo() {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="flex flex-col items-center gap-2 rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3">
        <CloudflareIcon glyph="cloudflare-gateway-outline" size="xs" />
        <Text size="sm" variant="secondary">
          xs
        </Text>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3">
        <CloudflareIcon glyph="cloudflare-gateway-outline" size="sm" />
        <Text size="sm" variant="secondary">
          sm
        </Text>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3">
        <CloudflareIcon glyph="cloudflare-gateway-outline" size="base" />
        <Text size="sm" variant="secondary">
          base
        </Text>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3">
        <CloudflareIcon glyph="cloudflare-gateway-outline" size="lg" />
        <Text size="sm" variant="secondary">
          lg
        </Text>
      </div>
    </div>
  );
}

export function CloudflareIconAccessibilityDemo() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-kumo-line bg-kumo-elevated p-4">
        <div className="mb-2">
          <Text size="sm" bold>
            Decorative icon
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <CloudflareIcon glyph="cloudflare-pages-outline" size="lg" />
          <Text size="sm" variant="secondary">
            Decorative icons can stay unlabeled when nearby text already names the
            UI.
          </Text>
        </div>
      </div>

      <div className="rounded-lg border border-kumo-line bg-kumo-elevated p-4">
        <div className="mb-2">
          <Text size="sm" bold>
            Labeled icon
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <CloudflareIcon
            glyph="cloudflare-pages-outline"
            size="lg"
            title="Cloudflare Pages"
          />
          <Text size="sm" variant="secondary">
            Add <code>title</code> when the icon needs its own accessible name.
          </Text>
        </div>
      </div>
    </div>
  );
}

export function CloudflareIconColorDemo() {
  return (
    <div className="flex flex-col items-stretch gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3">
        <CloudflareIcon glyph="cloudflare-radar-outline" size="lg" />
        <Text size="sm" variant="secondary">
          Default semantic color
        </Text>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3">
        <CloudflareIcon
          glyph="cloudflare-radar-outline"
          size="lg"
          className="text-kumo-brand"
        />
        <Text size="sm" variant="secondary">
          <code>className=&quot;text-kumo-brand&quot;</code>
        </Text>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3">
        <CloudflareIcon
          glyph="cloudflare-radar-outline"
          size="lg"
          className="text-kumo-danger"
        />
        <Text size="sm" variant="secondary">
          <code>className=&quot;text-kumo-danger&quot;</code>
        </Text>
      </div>
    </div>
  );
}

export function CloudflareIconGalleryDemo() {
  const [query, setQuery] = useState("");
  const [copiedGlyph, setCopiedGlyph] = useState<CloudflareIconName | null>(null);

  const filteredGlyphs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return cloudflareIconNames;
    }

    return cloudflareIconNames.filter((glyph) =>
      glyph.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  const copyGlyphName = async (glyph: CloudflareIconName) => {
    await navigator.clipboard.writeText(glyph);
    setCopiedGlyph(glyph);
    window.setTimeout(() => {
      setCopiedGlyph((current) => (current === glyph ? null : current));
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="w-full">
        <Input
          aria-label="Search Cloudflare icon glyphs"
          placeholder="Search glyph names"
          className="w-full"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <Text size="sm" variant="secondary">
        Showing <span className="font-medium text-kumo-default">{filteredGlyphs.length}</span> of{" "}
        <span className="font-medium text-kumo-default">{cloudflareIconNames.length}</span> glyphs
      </Text>

      {filteredGlyphs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-kumo-line bg-kumo-elevated px-6 py-12 text-center">
          <Text size="sm" bold>
            No glyphs found
          </Text>
          <Text size="sm" variant="secondary">
            Try a broader search term like <code>cloudflare</code>, <code>outline</code>, or <code>security</code>.
          </Text>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filteredGlyphs.map((glyph) => {
            const copied = copiedGlyph === glyph;

            return (
              <button
                key={glyph}
                type="button"
                onClick={() => void copyGlyphName(glyph)}
                className={cn(
                  "relative flex min-h-32 flex-col items-center justify-center gap-4 rounded-lg border bg-kumo-base p-4 text-center transition-colors",
                  copied
                    ? "border-kumo-brand bg-kumo-brand/5"
                    : "border-kumo-line hover:border-kumo-ring hover:bg-kumo-elevated",
                )}
              >
                {copied ? (
                  <span className="absolute top-3 right-3 text-xs font-medium text-kumo-subtle">
                    Copied
                  </span>
                ) : null}
                <CloudflareIcon glyph={glyph} size="lg" />
                <span className="line-clamp-3 text-center font-mono text-xs text-kumo-subtle">
                  {glyph}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => {
            setQuery("");
            setCopiedGlyph(null);
          }}
        >
          Reset gallery
        </Button>
      </div>
    </div>
  );
}
