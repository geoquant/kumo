/**
 * @a2ui-bridge/react-kumo - Code adapter
 * Maps A2UI Code nodes to @cloudflare/kumo Code
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Code as KumoCode } from "@cloudflare/kumo";

export function Code({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const code =
    properties.code?.literalString ??
    properties.code?.literal ??
    properties.text?.literalString ??
    properties.text?.literal ??
    "";
  const language =
    properties.language?.literalString ?? properties.language?.literal ?? "ts";

  const langMap: Record<string, "ts" | "tsx" | "jsonc" | "bash" | "css"> = {
    typescript: "ts",
    ts: "ts",
    tsx: "tsx",
    javascript: "ts",
    js: "ts",
    json: "jsonc",
    jsonc: "jsonc",
    bash: "bash",
    sh: "bash",
    shell: "bash",
    css: "css",
  };

  return <KumoCode code={code} lang={langMap[language] ?? "ts"} />;
}
