import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeIconName } from "./generate-cloudflare-icons.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSETS_DIR = join(__dirname, "../src/icons/assets");
const EXPECTED_VIEWBOX = "0 0 16 16";

function warn(message) {
  console.warn(`WARN: ${message}`);
}

function parseSvg(fileName, source) {
  const svgMatch = source.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);

  if (!svgMatch) {
    return null;
  }

  return {
    attrs: svgMatch[1],
    body: svgMatch[2].trim(),
  };
}

function main() {
  if (!existsSync(ASSETS_DIR)) {
    console.error(`Cloudflare icon assets directory not found: ${ASSETS_DIR}`);
    process.exitCode = 1;
    return;
  }

  const svgFiles = readdirSync(ASSETS_DIR)
    .filter((file) => extname(file).toLowerCase() === ".svg")
    .sort((a, b) => a.localeCompare(b));

  let warningCount = 0;

  for (const fileName of svgFiles) {
    const filePath = join(ASSETS_DIR, fileName);
    const source = readFileSync(filePath, "utf8").trim();
    const normalizedName = normalizeIconName(fileName);
    const expectedFileName = `${normalizedName}.svg`;

    if (fileName !== expectedFileName) {
      warningCount += 1;
      warn(`${fileName}: filename should normalize to ${expectedFileName}`);
    }

    if (/^<\?xml\b/i.test(source)) {
      warningCount += 1;
      warn(`${fileName}: XML declaration can be removed from committed assets`);
    }

    const parsed = parseSvg(fileName, source);

    if (!parsed) {
      warningCount += 1;
      warn(`${fileName}: invalid SVG root element`);
      continue;
    }

    const { attrs, body } = parsed;
    const viewBoxMatch = attrs.match(/\bviewBox=["']([^"']+)["']/i);
    const widthMatch = attrs.match(/\bwidth=["']([^"']+)["']/i);
    const heightMatch = attrs.match(/\bheight=["']([^"']+)["']/i);

    if (!viewBoxMatch) {
      warningCount += 1;
      warn(`${fileName}: missing viewBox (expected ${EXPECTED_VIEWBOX})`);
    } else if (viewBoxMatch[1] !== EXPECTED_VIEWBOX) {
      warningCount += 1;
      warn(
        `${fileName}: viewBox is ${viewBoxMatch[1]} (expected ${EXPECTED_VIEWBOX})`,
      );
    }

    if (widthMatch || heightMatch) {
      warningCount += 1;
      warn(`${fileName}: width/height attributes should be removed in favor of viewBox only`);
    }

    if (body.length === 0) {
      warningCount += 1;
      warn(`${fileName}: SVG body is empty`);
    }

    if (/<script\b/i.test(body)) {
      warningCount += 1;
      warn(`${fileName}: <script> tags are not allowed in icon assets`);
    }

    if (/\son[a-z]+\s*=/i.test(body)) {
      warningCount += 1;
      warn(`${fileName}: inline event handler attributes are not allowed in icon assets`);
    }
  }

  if (warningCount === 0) {
    console.log(
      `✓ Cloudflare icon asset validation passed (${svgFiles.length} SVG assets, no warnings)`,
    );
    return;
  }

  console.log(
    `⚠ Cloudflare icon asset validation completed with ${warningCount} warning${warningCount === 1 ? "" : "s"}`,
  );
  console.log("This check is warning-only and does not fail the build.");
}

main();
