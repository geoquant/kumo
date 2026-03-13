import { type FC, useMemo } from "react";
import themeMetadata from "@cloudflare/kumo/ai/theme-metadata.json";

type ThemeMetadataToken = (typeof themeMetadata.tokens)[number];
type ThemeName = (typeof themeMetadata.themes)[number];
type ThemeColorMode = {
  light: string;
  dark: string;
};

function isThemeColorMode(value: unknown): value is ThemeColorMode {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.light === "string" && typeof candidate.dark === "string"
  );
}

function extractColorValue(value: string): string {
  const varMatch = value.match(/^var\([^,]+,\s*(.+)\)$/);
  return varMatch ? varMatch[1] : value;
}

function colorToHex(color: string): string | null {
  if (typeof document === "undefined") return null;

  const actualColor = extractColorValue(color);

  if (actualColor.startsWith("#") || actualColor === "transparent") return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = actualColor;
    ctx.fillRect(0, 0, 1, 1);
    const imageData = ctx.getImageData(0, 0, 1, 1).data;
    const r = imageData[0] ?? 0;
    const g = imageData[1] ?? 0;
    const b = imageData[2] ?? 0;
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

const textTokens = themeMetadata.tokens.filter(
  (token): token is ThemeMetadataToken => token.kind === "text",
);
const colorTokens = themeMetadata.tokens.filter(
  (token): token is ThemeMetadataToken => token.kind === "color",
);
const DEFAULT_THEME: ThemeName = "kumo";

function getEffectiveTokenValue(
  token: ThemeMetadataToken,
  selectedTheme: ThemeName,
): ThemeColorMode | null {
  const selectedValue = token.themes[selectedTheme];
  if (isThemeColorMode(selectedValue)) return selectedValue;

  const defaultValue = token.themes.kumo;
  return isThemeColorMode(defaultValue) ? defaultValue : null;
}

const ColorSwatch: FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const hex = useMemo(() => colorToHex(value), [value]);

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex h-8 w-8 shrink-0 rounded border border-kumo-fill"
        style={{ background: value }}
      />
      <div className="flex flex-col text-xs text-kumo-default">
        <span className="text-[10px] uppercase tracking-wide text-kumo-subtle">
          {label}
        </span>
        <span className="truncate text-[10px] text-kumo-strong">
          {value}
          {hex ? (
            <span className="ml-1 font-mono font-medium text-kumo-default">
              {hex}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
};

const TokenGrid: FC<{
  tokens: ThemeMetadataToken[];
  selectedTheme: ThemeName;
}> = ({ tokens, selectedTheme }) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    {tokens.map((token) => {
      const value = getEffectiveTokenValue(token, selectedTheme);
      if (value === null) return null;

      return (
        <div
          key={token.name}
          className="flex items-center gap-3 rounded-md border border-kumo-fill bg-kumo-base px-3 py-2 text-xs"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-kumo-default">
                {token.name}
              </span>
            </div>
            <ColorSwatch label="Light" value={value.light} />
            <ColorSwatch label="Dark" value={value.dark} />
          </div>
        </div>
      );
    })}
  </div>
);

export const TailwindColorTokens: FC = () => {
  return (
    <div className="flex flex-col gap-8 bg-kumo-elevated p-8 text-kumo-default">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-2xl font-semibold">Colors</h2>
          <div className="text-sm text-kumo-strong">
            Displaying {textTokens.length + colorTokens.length} semantic tokens
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">
          Text Colors ({textTokens.length})
        </h2>
        <TokenGrid tokens={textTokens} selectedTheme={DEFAULT_THEME} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">
          Surface, State & Theme Colors ({colorTokens.length})
        </h2>
        <TokenGrid tokens={colorTokens} selectedTheme={DEFAULT_THEME} />
      </section>
    </div>
  );
};
