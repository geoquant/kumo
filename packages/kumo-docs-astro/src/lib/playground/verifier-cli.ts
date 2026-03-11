import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildPlaygroundVerifierReport,
  type PlaygroundVerifierReport,
} from "~/lib/playground/verifier";

interface RegistryPropSchema {
  readonly type?: string;
  readonly values?: readonly string[];
}

interface RegistryComponentSchema {
  readonly props?: Readonly<Record<string, RegistryPropSchema>>;
}

interface RegistryJson {
  readonly components: Readonly<Record<string, RegistryComponentSchema>>;
}

const componentRegistry = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), "../kumo/ai/component-registry.json"),
    "utf8",
  ),
) as RegistryJson;

const DEFAULT_BASE_URL = "http://127.0.0.1:4321";
const DEFAULT_MODEL = "gpt-oss-120b";

const VARIANT_COMPONENT_NAMES = [
  "Badge",
  "Banner",
  "Button",
  "Checkbox",
  "CloudflareLogo",
  "Grid",
  "Input",
  "Link",
  "Switch",
  "Table",
  "Tabs",
  "Text",
] as const;

interface VariantComponent {
  readonly name: string;
  readonly variants: readonly string[];
}

const VARIANT_COMPONENTS: readonly VariantComponent[] =
  VARIANT_COMPONENT_NAMES.flatMap((name) => {
    const component = componentRegistry.components[name];
    const variant = component?.props?.["variant"];
    if (
      variant?.type !== "enum" ||
      variant.values === undefined ||
      variant.values.length === 0
    ) {
      return [];
    }

    return [{ name, variants: variant.values }];
  });

export interface PlaygroundVerifierCliOptions {
  readonly prompt: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly outputRoot: string;
  readonly historyFile?: string;
  readonly currentUiFile?: string;
}

export interface PlaygroundVerifierRequestArtifact {
  readonly url: string;
  readonly body: Record<string, unknown>;
  readonly effectivePromptText: string;
}

export interface PlaygroundVerifierArtifactBundle {
  readonly artifactDir: string;
  readonly request: PlaygroundVerifierRequestArtifact;
  readonly rawSse: string;
  readonly report: PlaygroundVerifierReport;
}

function readOptionValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

export function parsePlaygroundVerifierCliArgs(
  argv: readonly string[],
): PlaygroundVerifierCliOptions {
  let prompt: string | null = null;
  let baseUrl = process.env["PLAYGROUND_VERIFY_BASE_URL"] ?? DEFAULT_BASE_URL;
  let model = process.env["PLAYGROUND_VERIFY_MODEL"] ?? DEFAULT_MODEL;
  let outputRoot = path.resolve("artifacts/playground-verifier");
  let historyFile: string | undefined;
  let currentUiFile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--prompt") {
      prompt = readOptionValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--url") {
      baseUrl = readOptionValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--model") {
      model = readOptionValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--output-dir") {
      outputRoot = path.resolve(readOptionValue(arg, next));
      index += 1;
      continue;
    }

    if (arg === "--history-file") {
      historyFile = path.resolve(readOptionValue(arg, next));
      index += 1;
      continue;
    }

    if (arg === "--current-ui-file") {
      currentUiFile = path.resolve(readOptionValue(arg, next));
      index += 1;
      continue;
    }
  }

  if (prompt === null || prompt.trim() === "") {
    throw new Error("Missing required --prompt value");
  }

  return {
    prompt,
    baseUrl,
    model,
    outputRoot,
    historyFile,
    currentUiFile,
  };
}

export function isExhaustiveVariantShowcasePrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();

  return (
    normalized.includes("kumo") &&
    normalized.includes("component") &&
    normalized.includes("variant") &&
    (normalized.includes("every") || normalized.includes("all"))
  );
}

export function buildVariantShowcasePromptSupplement(): string {
  return [
    "# Exhaustive Variant Showcase",
    "",
    "The user wants an exhaustive panel A showcase.",
    "- Render every supported variant for every generative Kumo component listed below.",
    "- Use real component instances, not text-only labels pretending to be components.",
    "- Group output by component name.",
    "- Keep layout compact, but do not omit any listed variant.",
    "- Do not invent components or variants not listed here.",
    "",
    ...VARIANT_COMPONENTS.map(
      (component) => `- ${component.name}: ${component.variants.join(" | ")}`,
    ),
  ].join("\n");
}

async function readOptionalHistory(filePath: string | undefined) {
  if (filePath === undefined) {
    return undefined;
  }

  const text = await readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("History file must contain a JSON array.");
  }

  return parsed;
}

async function readOptionalCurrentUi(filePath: string | undefined) {
  if (filePath === undefined) {
    return undefined;
  }

  return readFile(filePath, "utf8");
}

export async function buildPanelAVerifierRequestArtifact(
  options: PlaygroundVerifierCliOptions,
): Promise<PlaygroundVerifierRequestArtifact> {
  const [history, currentUITree, promptResponse] = await Promise.all([
    readOptionalHistory(options.historyFile),
    readOptionalCurrentUi(options.currentUiFile),
    fetch(new URL("/api/chat/prompt", options.baseUrl)),
  ]);

  if (!promptResponse.ok) {
    throw new Error(
      `Failed to fetch panel A prompt (${String(promptResponse.status)})`,
    );
  }

  const basePrompt = await promptResponse.text();
  const systemPromptSupplement = isExhaustiveVariantShowcasePrompt(
    options.prompt,
  )
    ? buildVariantShowcasePromptSupplement()
    : undefined;

  const body: Record<string, unknown> = {
    message: options.prompt,
    model: options.model,
  };

  if (history !== undefined) {
    body.history = history;
  }
  if (currentUITree !== undefined) {
    body.currentUITree = currentUITree;
  }
  if (systemPromptSupplement !== undefined) {
    body.systemPromptSupplement = systemPromptSupplement;
  }

  return {
    url: new URL("/api/chat", options.baseUrl).toString(),
    body,
    effectivePromptText:
      systemPromptSupplement === undefined
        ? basePrompt
        : `${basePrompt}\n\n${systemPromptSupplement}`,
  };
}

export async function requestPanelAVerifierRun(
  artifact: PlaygroundVerifierRequestArtifact,
): Promise<string> {
  const response = await fetch(artifact.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(artifact.body),
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    const errorMessage =
      typeof errorBody === "object" &&
      errorBody !== null &&
      "error" in errorBody &&
      typeof errorBody.error === "string"
        ? errorBody.error
        : `Panel A request failed (${String(response.status)})`;
    throw new Error(errorMessage);
  }

  return response.text();
}

function buildTimestampDirectoryName(date: Date): string {
  return date.toISOString().replaceAll(":", "-");
}

export function formatPlaygroundVerifierMarkdown(
  report: PlaygroundVerifierReport,
): string {
  return [
    "# Playground Panel A Verifier",
    "",
    `- status: ${report.status}`,
    `- model: ${report.prompt.model}`,
    `- prompt chars: ${String(report.prompt.promptChars)}`,
    `- prompt token estimate: ${String(report.prompt.promptTokenEstimate)}`,
    `- SSE bytes: ${String(report.stream.sseBytes)}`,
    `- assistant chars: ${String(report.stream.assistantChars)}`,
    `- JSONL lines: ${String(report.stream.jsonlLineCount)}`,
    `- patch ops: ${String(report.stream.patchOpCount)}`,
    `- renderable: ${String(report.tree.renderable)}`,
    `- element count: ${String(report.tree.elementCount)}`,
    `- max depth: ${String(report.tree.maxDepth)}`,
    `- repaired elements: ${String(report.validation.repairedElementCount)}`,
    `- stripped props: ${String(report.validation.strippedPropCount)}`,
    `- malformed structures: ${String(report.tree.malformedStructureCount)}`,
    `- reasons: ${report.reasons.length === 0 ? "none" : report.reasons.join("; ")}`,
  ].join("\n");
}

export async function writePlaygroundVerifierArtifacts(input: {
  readonly outputRoot: string;
  readonly request: PlaygroundVerifierRequestArtifact;
  readonly rawSse: string;
  readonly report: PlaygroundVerifierReport;
  readonly now?: Date;
}): Promise<string> {
  const artifactDir = path.join(
    input.outputRoot,
    buildTimestampDirectoryName(input.now ?? new Date()),
  );

  await mkdir(artifactDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(artifactDir, "request.json"),
      `${JSON.stringify(input.request, null, 2)}\n`,
      "utf8",
    ),
    writeFile(path.join(artifactDir, "response.sse"), input.rawSse, "utf8"),
    writeFile(
      path.join(artifactDir, "assistant.jsonl"),
      input.report.assistantJsonl,
      "utf8",
    ),
    writeFile(
      path.join(artifactDir, "report.json"),
      `${JSON.stringify(input.report, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(artifactDir, "report.md"),
      `${formatPlaygroundVerifierMarkdown(input.report)}\n`,
      "utf8",
    ),
  ]);

  return artifactDir;
}

export async function runPlaygroundVerifierCli(
  options: PlaygroundVerifierCliOptions,
): Promise<PlaygroundVerifierArtifactBundle> {
  const request = await buildPanelAVerifierRequestArtifact(options);
  const rawSse = await requestPanelAVerifierRun(request);
  const report = buildPlaygroundVerifierReport({
    request: {
      message: options.prompt,
      model: options.model,
      promptText: request.effectivePromptText,
    },
    rawSse,
  });
  const artifactDir = await writePlaygroundVerifierArtifacts({
    outputRoot: options.outputRoot,
    request,
    rawSse,
    report,
  });

  return {
    artifactDir,
    request,
    rawSse,
    report,
  };
}

export { DEFAULT_BASE_URL, DEFAULT_MODEL };
