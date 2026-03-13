import { type FC, useMemo, useState } from "react";
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
const availableThemes = [...themeMetadata.themes];

function getEffectiveTokenValue(
  token: ThemeMetadataToken,
  selectedTheme: ThemeName,
): ThemeColorMode | null {
  const selectedValue = token.themes[selectedTheme];
  if (isThemeColorMode(selectedValue)) return selectedValue;

  const defaultValue = token.themes.kumo;
  return isThemeColorMode(defaultValue) ? defaultValue : null;
}

function countThemeOverrides(selectedTheme: ThemeName): number {
  if (selectedTheme === "kumo") return 0;

  return [...textTokens, ...colorTokens].filter((token) =>
    isThemeColorMode(token.themes[selectedTheme]),
  ).length;
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
              {selectedTheme !== "kumo" &&
              isThemeColorMode(token.themes[selectedTheme]) ? (
                <span className="rounded bg-kumo-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-kumo-brand">
                  override
                </span>
              ) : null}
            </div>
            <ColorSwatch label="Light" value={value.light} />
            <ColorSwatch label="Dark" value={value.dark} />
          </div>
        </div>
      );
    })}
  </div>
);

const ThemePreview: FC<{ selectedTheme: ThemeName }> = ({ selectedTheme }) => (
  <div
    data-theme={selectedTheme}
    className="rounded-xl border border-kumo-line p-4"
  >
    <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr]">
      <div className="rounded-lg border border-kumo-line bg-kumo-base p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-kumo-default">
              Scoped theme preview
            </p>
            <p className="text-sm text-kumo-strong">
              This card inherits{" "}
              <code className="rounded bg-kumo-control px-1 py-0.5 text-xs">
                data-theme=&quot;{selectedTheme}&quot;
              </code>
            </p>
          </div>
          <span className="rounded-full bg-kumo-brand px-3 py-1 text-xs font-medium text-white">
            {selectedTheme}
          </span>
        </div>
        <div className="mt-4 rounded-lg border border-kumo-line bg-kumo-recessed p-3">
          <p className="text-sm font-medium text-kumo-default">
            Token names stay the same
          </p>
          <p className="mt-1 text-sm text-kumo-strong">
            Only the values behind semantic classes change per theme and mode.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-kumo-line bg-kumo-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-kumo-subtle">
          Sample values
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between rounded bg-kumo-base px-3 py-2 text-kumo-default">
            <span>Base surface</span>
            <span className="text-kumo-strong">bg-kumo-base</span>
          </div>
          <div className="flex items-center justify-between rounded bg-kumo-recessed px-3 py-2 text-kumo-default">
            <span>Recessed panel</span>
            <span className="text-kumo-strong">bg-kumo-recessed</span>
          </div>
          <div className="flex items-center justify-between rounded bg-kumo-control px-3 py-2 text-kumo-default">
            <span>Control chrome</span>
            <span className="text-kumo-strong">bg-kumo-control</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const TailwindColorTokens: FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>(
    availableThemes[0] ?? "kumo",
  );

  const overrideCount = useMemo(
    () => countThemeOverrides(selectedTheme),
    [selectedTheme],
  );

  return (
    <div className="flex flex-col gap-8 bg-kumo-elevated p-8 text-kumo-default">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-2xl font-semibold">Colors</h2>
          <div className="text-sm text-kumo-strong">
            Displaying {textTokens.length + colorTokens.length} semantic tokens
            {overrideCount > 0 ? (
              <span className="ml-1">
                — {overrideCount} overridden by{" "}
                <code className="rounded bg-kumo-control px-1 py-0.5 text-xs">
                  {selectedTheme}
                </code>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableThemes.map((theme) => {
            const isActive = theme === selectedTheme;

            return (
              <button
                key={theme}
                type="button"
                onClick={() => setSelectedTheme(theme)}
                aria-pressed={isActive}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-kumo-brand bg-kumo-brand text-white"
                    : "border-kumo-line bg-kumo-base text-kumo-default hover:bg-kumo-recessed",
                ].join(" ")}
              >
                {theme}
              </button>
            );
          })}
        </div>
      </div>

      <ThemePreview selectedTheme={selectedTheme} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">
          Text Colors ({textTokens.length})
        </h2>
        <TokenGrid tokens={textTokens} selectedTheme={selectedTheme} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">
          Surface, State & Theme Colors ({colorTokens.length})
        </h2>
        <TokenGrid tokens={colorTokens} selectedTheme={selectedTheme} />
      </section>
    </div>
  );
};
