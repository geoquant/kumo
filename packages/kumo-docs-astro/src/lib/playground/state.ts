import type {
  ActionLogEntry,
  EditorDraft,
  PanelArtifact,
  PanelId,
  PanelTab,
  PlaygroundLayoutState,
  StreamStatus,
  ValidationIssue,
} from "~/lib/playground/types";

export interface PlaygroundPanelsState {
  readonly a: PanelArtifact;
  readonly b: PanelArtifact;
}

type PlaygroundPanelsAction =
  | {
      readonly type: "set-tab";
      readonly panelId: PanelId;
      readonly tab: PanelTab;
    }
  | {
      readonly type: "set-tree";
      readonly panelId: PanelId;
      readonly tree: PanelArtifact["tree"];
    }
  | {
      readonly type: "set-local-tree-override";
      readonly panelId: PanelId;
      readonly tree: PanelArtifact["tree"] | null;
    }
  | {
      readonly type: "set-status";
      readonly panelId: PanelId;
      readonly status: StreamStatus;
    }
  | {
      readonly type: "set-raw-jsonl";
      readonly panelId: PanelId;
      readonly rawJsonl: string;
    }
  | {
      readonly type: "append-action-log";
      readonly panelId: PanelId;
      readonly entry: ActionLogEntry;
    }
  | {
      readonly type: "clear-action-log";
      readonly panelId: PanelId;
    }
  | {
      readonly type: "set-editor-text";
      readonly panelId: PanelId;
      readonly text: string;
      readonly source: EditorDraft["source"];
      readonly status?: EditorDraft["status"];
    }
  | {
      readonly type: "set-editor-validation";
      readonly panelId: PanelId;
      readonly issues: readonly ValidationIssue[];
    }
  | {
      readonly type: "mark-editor-applied";
      readonly panelId: PanelId;
      readonly appliedAt: string;
    }
  | {
      readonly type: "reset-editor";
      readonly panelId: PanelId;
      readonly text: string;
    };

type PlaygroundLayoutAction =
  | { readonly type: "toggle-chat-minimized" }
  | { readonly type: "set-chat-minimized"; readonly value: boolean }
  | { readonly type: "set-catalog-open"; readonly value: boolean }
  | {
      readonly type: "set-mobile-view";
      readonly value: PlaygroundLayoutState["mobileView"];
    }
  | {
      readonly type: "set-desktop-root-sizes";
      readonly value: readonly [number, number];
    }
  | {
      readonly type: "set-workspace-sizes";
      readonly value: readonly [number, number];
    };

function createEditorDraft(): EditorDraft {
  return {
    text: "",
    status: "clean",
    source: "stream",
    validationIssues: [],
    lastAppliedAt: null,
  };
}

function createPanelArtifact(): PanelArtifact {
  return {
    tree: { root: "", elements: {} },
    localTreeOverride: null,
    rawJsonl: "",
    status: "idle",
    activeTab: "preview",
    actionLog: [],
    editor: createEditorDraft(),
  };
}

export function createInitialPlaygroundPanelsState(): PlaygroundPanelsState {
  return {
    a: createPanelArtifact(),
    b: createPanelArtifact(),
  };
}

export function createInitialPlaygroundLayoutState(): PlaygroundLayoutState {
  return {
    chatMinimized: false,
    catalogOpen: false,
    mobileView: "chat",
    desktopRootSizes: [28, 72],
    workspaceSizes: [50, 50],
  };
}

function updatePanel(
  state: PlaygroundPanelsState,
  panelId: PanelId,
  updater: (panel: PanelArtifact) => PanelArtifact,
): PlaygroundPanelsState {
  const nextPanel = updater(state[panelId]);
  return panelId === "a"
    ? { ...state, a: nextPanel }
    : { ...state, b: nextPanel };
}

export function playgroundPanelsReducer(
  state: PlaygroundPanelsState,
  action: PlaygroundPanelsAction,
): PlaygroundPanelsState {
  switch (action.type) {
    case "set-tree":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        tree: action.tree,
      }));
    case "set-local-tree-override":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        localTreeOverride: action.tree,
      }));
    case "set-tab":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        activeTab: action.tab,
      }));
    case "set-status":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        status: action.status,
      }));
    case "set-raw-jsonl":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        rawJsonl: action.rawJsonl,
      }));
    case "append-action-log":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        actionLog: [...panel.actionLog, action.entry],
      }));
    case "clear-action-log":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        actionLog: [],
      }));
    case "set-editor-text":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        editor: {
          ...panel.editor,
          text: action.text,
          source: action.source,
          status:
            action.status ??
            (action.text === panel.editor.text ? panel.editor.status : "dirty"),
        },
      }));
    case "set-editor-validation":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        editor: {
          ...panel.editor,
          status: action.issues.length === 0 ? "clean" : "invalid",
          validationIssues: action.issues,
        },
      }));
    case "mark-editor-applied":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        editor: {
          ...panel.editor,
          status: "applied",
          validationIssues: [],
          lastAppliedAt: action.appliedAt,
        },
      }));
    case "reset-editor":
      return updatePanel(state, action.panelId, (panel) => ({
        ...panel,
        editor: {
          ...createEditorDraft(),
          text: action.text,
        },
        localTreeOverride: null,
      }));
  }
}

export function playgroundLayoutReducer(
  state: PlaygroundLayoutState,
  action: PlaygroundLayoutAction,
): PlaygroundLayoutState {
  switch (action.type) {
    case "toggle-chat-minimized":
      return {
        ...state,
        chatMinimized: !state.chatMinimized,
      };
    case "set-chat-minimized":
      return {
        ...state,
        chatMinimized: action.value,
      };
    case "set-catalog-open":
      return {
        ...state,
        catalogOpen: action.value,
      };
    case "set-mobile-view":
      return {
        ...state,
        mobileView: action.value,
      };
    case "set-desktop-root-sizes":
      return {
        ...state,
        desktopRootSizes: action.value,
      };
    case "set-workspace-sizes":
      return {
        ...state,
        workspaceSizes: action.value,
      };
  }
}
