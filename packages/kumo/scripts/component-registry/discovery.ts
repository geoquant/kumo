/**
 * Component discovery for registry generation.
 *
 * Auto-discovers components from the filesystem and builds configurations
 * by parsing index.ts exports and component files.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  ComponentConfig,
  ComponentType,
  ComponentOverride,
  DetectedExports,
} from "./types.js";
import { toPascalCase } from "./utils.js";
import {
  extractVariantsFromFile,
  extractStylingFromFile,
} from "./variant-parser.js";

// =============================================================================
// Category Configuration
// =============================================================================

/**
 * Category mappings based on component type.
 * Key is the directory name (kebab-case).
 */
export const CATEGORY_MAP: Record<string, string> = {
  // Action
  button: "Action",
  "clipboard-text": "Action",
  // Display
  badge: "Display",
  breadcrumbs: "Display",
  code: "Display",
  collapsible: "Display",
  empty: "Display",
  "layer-card": "Display",
  meter: "Display",
  text: "Display",
  // Feedback
  banner: "Feedback",
  loader: "Feedback",
  toast: "Feedback",
  // Input
  checkbox: "Input",
  combobox: "Input",
  "date-range-picker": "Input",
  field: "Input",
  input: "Input",
  radio: "Input",
  select: "Input",
  switch: "Input",
  // Layout
  flow: "Layout",
  grid: "Layout",
  surface: "Layout",
  // Navigation
  "command-palette": "Navigation",
  menubar: "Navigation",
  pagination: "Navigation",
  tabs: "Navigation",
  // Overlay
  dialog: "Overlay",
  dropdown: "Overlay",
  popover: "Overlay",
  tooltip: "Overlay",
  // Blocks
  "page-header": "Layout",
  "resource-list": "Layout",
};

/**
 * Overrides for component metadata that can't be auto-detected.
 * Key is the directory name (kebab-case).
 * Note: Component names and props types are now auto-detected from index.ts exports.
 */
export const COMPONENT_OVERRIDES: Record<string, ComponentOverride> = {};

// =============================================================================
// Export Detection
// =============================================================================

/**
 * Parse index.ts to detect the main component name and props type.
 * This eliminates the need for manual overrides for naming conventions.
 *
 * Detection rules:
 * 1. Component name: First PascalCase named export (not a type)
 * 2. Props type: First export matching *Props pattern
 */
export function detectExportsFromIndex(dirPath: string): DetectedExports {
  const indexPath = join(dirPath, "index.ts");
  const result: DetectedExports = { componentName: null, propsType: null };

  if (!existsSync(indexPath)) {
    return result;
  }

  try {
    const content = readFileSync(indexPath, "utf-8");

    // Match named exports: export { Foo, Bar, type BazProps } from "./file"
    // Also handles: export { Foo } from "./file"
    const exportPattern = /export\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null;

    const namedExports: string[] = [];
    const typeExports: string[] = [];

    while ((match = exportPattern.exec(content)) !== null) {
      const exportList = match[1];
      // Split by comma and process each export
      const items = exportList
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const item of items) {
        // Check if it's a type export: "type FooProps" or "type Foo as Bar"
        const typeMatch = item.match(/^type\s+(\w+)(?:\s+as\s+(\w+))?/);
        if (typeMatch) {
          // Use aliased name if present, otherwise original name
          typeExports.push(typeMatch[2] || typeMatch[1]);
        } else {
          // Regular named export, could have "as" alias: "Foo as Bar"
          const nameMatch = item.match(/^(\w+)(?:\s+as\s+(\w+))?/);
          if (nameMatch) {
            // Use aliased name if present, otherwise original name
            namedExports.push(nameMatch[2] || nameMatch[1]);
          }
        }
      }
    }

    // Also match direct exports: export const Foo = ...
    const directExportPattern = /export\s+(?:const|function)\s+(\w+)/g;
    while ((match = directExportPattern.exec(content)) !== null) {
      namedExports.push(match[1]);
    }

    // Find main component: first PascalCase export that's not a type/hook/constant
    for (const name of namedExports) {
      // Skip hooks (useXxx), constants (SCREAMING_CASE), and lowercase names
      if (
        name.startsWith("use") ||
        name === name.toUpperCase() ||
        name[0] !== name[0].toUpperCase()
      ) {
        continue;
      }
      // Skip variant functions (xxxVariants)
      if (name.endsWith("Variants")) {
        continue;
      }
      result.componentName = name;
      break;
    }

    // Find props type: look for ComponentNameProps or any *Props export
    if (result.componentName) {
      // First try exact match: ComponentNameProps
      const exactPropsType = `${result.componentName}Props`;
      if (typeExports.includes(exactPropsType)) {
        result.propsType = exactPropsType;
      }
    }

    // If no exact match, look for any *Props type
    if (!result.propsType) {
      const propsType = typeExports.find((t) => t.endsWith("Props"));
      if (propsType) {
        result.propsType = propsType;
      }
    }

    return result;
  } catch {
    return result;
  }
}

/**
 * Detect props type from the main component file by looking for interfaces/types.
 * Checks both exported and non-exported types since many components use internal type aliases.
 * Falls back to standard naming convention if not found in index.ts.
 */
export function detectPropsTypeFromFile(
  filePath: string,
  componentName: string,
): string | null {
  try {
    const content = readFileSync(filePath, "utf-8");

    // Look for interface/type that ends with Props (both exported and non-exported)
    // Pattern: [export] interface FooProps or [export] type FooProps
    const exportedPropsPattern = /export\s+(?:interface|type)\s+(\w+Props)/g;
    const nonExportedPropsPattern =
      /(?:^|\n)\s*(?:interface|type)\s+(\w+Props)\s*[=<{]/g;

    const exportedTypes: string[] = [];
    const nonExportedTypes: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = exportedPropsPattern.exec(content)) !== null) {
      exportedTypes.push(match[1]);
    }

    while ((match = nonExportedPropsPattern.exec(content)) !== null) {
      // Skip if it's actually exported (already captured above)
      if (!exportedTypes.includes(match[1])) {
        nonExportedTypes.push(match[1]);
      }
    }

    // Prefer exact match: ComponentNameProps (check exported first, then non-exported)
    const exactMatch = `${componentName}Props`;
    if (exportedTypes.includes(exactMatch)) {
      return exactMatch;
    }
    if (nonExportedTypes.includes(exactMatch)) {
      return exactMatch;
    }

    // Otherwise return first Props type found (prefer exported)
    return exportedTypes[0] || nonExportedTypes[0] || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Description Extraction
// =============================================================================

/**
 * Extract description text from JSDoc content.
 * Stops at first @tag (like @example, @see, @param, etc.)
 */
function extractDescriptionFromJSDoc(jsdocContent: string): string | null {
  const lines: string[] = [];

  for (const rawLine of jsdocContent.split("\n")) {
    const line = rawLine.replace(/^\s*\*\s?/, "").trim();

    // Stop at any @tag
    if (line.startsWith("@")) {
      break;
    }

    // Skip empty lines at the start, but allow them in the middle
    if (line.length > 0 || lines.length > 0) {
      lines.push(line);
    }
  }

  // Trim trailing empty lines and join
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length > 0) {
    return lines.join(" ").trim();
  }

  return null;
}

/**
 * Extract component description from JSDoc comment or generate a default one.
 * Looks for JSDoc directly before the component function/const declaration.
 *
 * Handles multiple patterns:
 * - export function ComponentName
 * - export const ComponentName = forwardRef
 * - export const ComponentName = Object.assign (compound components)
 *
 * Excludes:
 * - @example blocks and code
 * - @see and other JSDoc tags
 */
export function extractDescription(
  filePath: string,
  componentName: string,
): string {
  try {
    const content = readFileSync(filePath, "utf-8");

    // First, find the position of the component declaration
    // Handles: export function X, export const X =, function X(
    const componentDeclPattern = new RegExp(
      `(?:export\\s+)?(?:function|const)\\s+${componentName}\\s*(?:=|\\()`,
    );
    const componentMatch = content.match(componentDeclPattern);

    if (!componentMatch?.index) {
      return `${componentName} component`;
    }

    const componentPos = componentMatch.index;

    // Find all JSDoc comments in the file
    const jsdocPattern = /\/\*\*\s*\n([\s\S]*?)\*\//g;
    let lastJSDoc: { content: string; endPos: number } | null = null;
    let match: RegExpExecArray | null;

    while ((match = jsdocPattern.exec(content)) !== null) {
      const jsdocEndPos = match.index + match[0].length;

      // Only consider JSDoc comments that appear before the component
      if (jsdocEndPos > componentPos) {
        break;
      }

      // Check if this JSDoc is immediately before the component
      // (only whitespace/newlines between JSDoc end and component declaration)
      const textBetween = content.slice(jsdocEndPos, componentPos);
      if (/^\s*$/.test(textBetween)) {
        lastJSDoc = { content: match[1], endPos: jsdocEndPos };
      }
    }

    // Extract description from the closest JSDoc
    if (lastJSDoc) {
      const description = extractDescriptionFromJSDoc(lastJSDoc.content);
      if (description) {
        return description;
      }
    }

    // Generate default description from component name
    return `${componentName} component`;
  } catch {
    return `${componentName} component`;
  }
}

// =============================================================================
// Main File Resolution
// =============================================================================

/**
 * Resolve the main component source file for a component directory.
 *
 * Resolution order:
 * 1. `{dirName}/{dirName}.tsx` — standard convention (e.g. button/button.tsx)
 * 2. Parse `index.ts` re-exports to find the file containing the main component
 *    (e.g. flow/index.ts → `import { FlowDiagram } from "./diagram"` → flow/diagram.tsx)
 *
 * Returns the absolute path to the main file, or null if not resolvable.
 */
export function resolveMainFile(
  dirPath: string,
  dirName: string,
): string | null {
  // 1. Standard convention: {dirName}/{dirName}.tsx
  const conventionalFile = join(dirPath, `${dirName}.tsx`);
  if (existsSync(conventionalFile)) {
    return conventionalFile;
  }

  // 2. Fallback: parse index.ts to find the source file for the main export
  const indexPath = join(dirPath, "index.ts");
  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, "utf-8");
    const detected = detectExportsFromIndex(dirPath);
    if (!detected.componentName) {
      return null;
    }

    // Find which file the main component is imported from.
    // Handles patterns:
    //   import { FlowDiagram } from "./diagram"
    //   export { Button } from "./button"
    //   const Flow = Object.assign(FlowDiagram, { ... })  → trace FlowDiagram import
    //
    // Strategy: find all `import { ... } from "./file"` and `export { ... } from "./file"`,
    // then check which one contains the main component name or its source identifier.

    // Collect all import/export-from mappings: identifier → relative path
    const identifierSources = new Map<string, string>();
    const importExportPattern =
      /(?:import|export)\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']/g;
    let match: RegExpExecArray | null;

    while ((match = importExportPattern.exec(content)) !== null) {
      const names = match[1]
        .split(",")
        .map((s) => s.trim().replace(/^type\s+/, ""));
      const relativePath = match[2];
      for (const raw of names) {
        // Handle "Foo as Bar" — we care about the local name (Bar) and the original (Foo)
        const asMatch = raw.match(/^(\w+)\s+as\s+(\w+)/);
        if (asMatch) {
          identifierSources.set(asMatch[1], relativePath);
          identifierSources.set(asMatch[2], relativePath);
        } else if (raw) {
          identifierSources.set(raw, relativePath);
        }
      }
    }

    // Direct re-export: export { ComponentName } from "./file"
    const directSource = identifierSources.get(detected.componentName);
    if (directSource) {
      return resolveRelativeSourceFile(dirPath, directSource);
    }

    // Indirect: const Component = Object.assign(Imported, { ... })
    // or const Component = forwardRef(...)
    // Find what identifier is assigned to the component name
    const assignPattern = new RegExp(
      `(?:const|let)\\s+${detected.componentName}\\s*=\\s*(?:Object\\.assign\\(\\s*(\\w+)|forwardRef)`,
    );
    const assignMatch = content.match(assignPattern);
    if (assignMatch?.[1]) {
      const sourceId = assignMatch[1];
      const source = identifierSources.get(sourceId);
      if (source) {
        return resolveRelativeSourceFile(dirPath, source);
      }
    }

    // Last resort: if there's only one .tsx import source, use that
    const tsxSources = new Set(
      [...identifierSources.values()].filter((p) => !p.endsWith(".css")),
    );
    if (tsxSources.size === 1) {
      return resolveRelativeSourceFile(dirPath, [...tsxSources][0]);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a relative import path (e.g. "./diagram") to an absolute source file path.
 */
function resolveRelativeSourceFile(
  dirPath: string,
  relativePath: string,
): string | null {
  // Try with .tsx extension
  const withTsx = join(dirPath, `${relativePath}.tsx`);
  if (existsSync(withTsx)) return withTsx;

  // Try with .ts extension
  const withTs = join(dirPath, `${relativePath}.ts`);
  if (existsSync(withTs)) return withTs;

  // Try as-is (might already have extension)
  const asIs = join(dirPath, relativePath);
  if (existsSync(asIs)) return asIs;

  // Try /index.tsx
  const indexFile = join(dirPath, relativePath, "index.tsx");
  if (existsSync(indexFile)) return indexFile;

  // Try /index.ts
  const indexTsFile = join(dirPath, relativePath, "index.ts");
  if (existsSync(indexTsFile)) return indexTsFile;

  return null;
}

// =============================================================================
// Directory Discovery
// =============================================================================

/**
 * Discover all component directories in a given source directory.
 * Returns array of directory names (kebab-case).
 *
 * A directory is considered a component if:
 * 1. It contains `{dirName}/{dirName}.tsx` (standard convention), OR
 * 2. It contains `index.ts` with a PascalCase component export
 */
export function discoverDirs(sourceDir: string): string[] {
  const entries = readdirSync(sourceDir);
  return entries.filter((entry) => {
    const fullPath = join(sourceDir, entry);
    if (!statSync(fullPath).isDirectory()) return false;
    return resolveMainFile(fullPath, entry) !== null;
  });
}

// =============================================================================
// Component Configuration Building
// =============================================================================

/**
 * Auto-discover and build configurations from a source directory.
 * Component/block names and props types are detected from index.ts exports.
 */
export async function discoverFromDir(
  sourceDir: string,
  type: ComponentType,
): Promise<ComponentConfig[]> {
  const dirs = discoverDirs(sourceDir);
  const configs: ComponentConfig[] = [];

  console.log(`Discovering ${type}s from ${sourceDir}...`);

  for (const dirName of dirs) {
    const dirPath = join(sourceDir, dirName);
    const mainFile =
      resolveMainFile(dirPath, dirName) ?? join(dirPath, `${dirName}.tsx`);
    const override = COMPONENT_OVERRIDES[dirName] || {};

    // Auto-detect component name and props type from index.ts
    const detected = detectExportsFromIndex(dirPath);

    // Determine component name: detected from index.ts, or fallback to PascalCase of dir name
    const baseName = toPascalCase(dirName);
    const componentName = detected.componentName || baseName;

    // Determine props type: detected from index.ts, then from main file, then convention
    let propsType = detected.propsType;
    if (!propsType) {
      propsType = detectPropsTypeFromFile(mainFile, componentName);
    }
    // Final fallback: standard convention
    if (!propsType) {
      propsType = `${componentName}Props`;
    }

    // Extract variants from file (may be empty for components without variant props)
    // Some components (like DatePicker) don't have KUMO_*_VARIANTS exports
    const variantsData = extractVariantsFromFile(mainFile);

    // Determine category
    const category = override.category || CATEGORY_MAP[dirName] || "Other";

    // Extract or generate description
    const description =
      override.description || extractDescription(mainFile, componentName);

    // Extract styling metadata from KUMO_*_STYLING if present
    const styling = extractStylingFromFile(mainFile);

    console.log(
      `  ${dirName} → ${componentName} (props: ${propsType}, type: ${type})`,
    );

    configs.push({
      name: componentName,
      propsType,
      sourceFile: mainFile.startsWith(sourceDir)
        ? mainFile.slice(sourceDir.length + 1)
        : `${dirName}/${dirName}.tsx`,
      dirName,
      sourceDir,
      type,
      description,
      category,
      variants: variantsData?.variants ?? {},
      defaults: variantsData?.defaults ?? {},
      ...(variantsData?.baseStyles && { baseStyles: variantsData.baseStyles }),
      ...(styling && { styling }),
      // Note: subComponents are added later by processComponent in index.ts
    });
  }

  return configs;
}

/**
 * Auto-discover and build component configurations from filesystem.
 * Discovers both components and blocks.
 */
export async function discoverComponents(
  componentsDir: string,
): Promise<ComponentConfig[]> {
  const componentConfigs = await discoverFromDir(componentsDir, "component");

  console.log(`Discovered ${componentConfigs.length} components`);

  // Sort by name for consistent output
  return componentConfigs.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Auto-discover and build block configurations from filesystem.
 * Blocks are composite components installed via CLI.
 */
export async function discoverBlocks(
  blocksDir: string,
): Promise<ComponentConfig[]> {
  const blockConfigs = await discoverFromDir(blocksDir, "block");

  console.log(`Discovered ${blockConfigs.length} blocks`);

  // Sort by name for consistent output
  return blockConfigs.sort((a, b) => a.name.localeCompare(b.name));
}
