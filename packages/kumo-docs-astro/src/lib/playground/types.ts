import type { ActionEvent, UITree } from "@cloudflare/kumo/streaming";

export type PanelId = "a" | "b";

export type StreamStatus = "idle" | "streaming" | "error";

export type PanelTab =
  | "preview"
  | "code"
  | "jsonl"
  | "actions"
  | "grading"
  | "prompt";

export interface ActionLogEntry {
  readonly timestamp: string;
  readonly event: ActionEvent;
}

export type EditorStatus = "clean" | "dirty" | "invalid" | "applied";

export interface ValidationIssue {
  readonly message: string;
  readonly path: readonly (string | number)[];
}

export interface EditorDraft {
  readonly text: string;
  readonly status: EditorStatus;
  readonly source: "stream" | "manual";
  readonly validationIssues: readonly ValidationIssue[];
  readonly lastAppliedAt: string | null;
}

export interface PanelArtifact {
  readonly tree: UITree;
  readonly rawJsonl: string;
  readonly status: StreamStatus;
  readonly activeTab: PanelTab;
  readonly actionLog: readonly ActionLogEntry[];
  readonly editor: EditorDraft;
}

export interface PlaygroundLayoutState {
  readonly chatMinimized: boolean;
  readonly catalogOpen: boolean;
  readonly mobileView: "chat" | "a" | "b" | "catalog";
  readonly desktopRootSizes: readonly [number, number];
  readonly workspaceSizes: readonly [number, number];
}
