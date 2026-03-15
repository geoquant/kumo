import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const kumoBindingCss = readFileSync(
  resolve(__dirname, "../../src/styles/kumo-binding.css"),
  "utf8",
);

describe("kumo binding css", () => {
  it("lets root color-scheme follow the system by default", () => {
    expect(kumoBindingCss).toMatch(/:root\s*\{\s*color-scheme: light dark;/);
    expect(kumoBindingCss).not.toMatch(/:root\s*\{\s*color-scheme: light;/);
  });

  it("supports explicit light and dark overrides", () => {
    expect(kumoBindingCss).toMatch(
      /\[data-mode="light"\]\s*\{\s*color-scheme: light;/,
    );
    expect(kumoBindingCss).toMatch(
      /\[data-mode="dark"\]\s*\{\s*color-scheme: dark;/,
    );
  });
});
