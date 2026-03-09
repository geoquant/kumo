import type { JsonPatchOp } from "../../streaming/rfc6902";
import type {
  AppElement,
  AppSpec,
  AppStoreSnapshot,
  CompatibleUITreeInput,
  ExpandedAppSpec,
  JsonPointer,
  KumoEventName,
  NestedAppSpec,
  RefSource,
  RepeatScope,
  RuntimeEffect,
  ValidationRunResult,
  WatcherRunResult,
} from "../core";
import type { CustomActionHandler } from "../core/actions";
import type { ValidationOptions } from "../core/validation";

export type StreamStatus = "idle" | "streaming" | "complete" | "error";

export interface ResolvedAppElement {
  readonly element: AppElement;
  readonly props: Record<string, unknown>;
  readonly bindings: Record<string, RefSource>;
  readonly visible: boolean;
  readonly repeat?: RepeatScope;
}

export interface AppRuntimeEvent {
  readonly elementKey: string;
  readonly event: KumoEventName;
}

export interface DispatchAppEventResult {
  readonly effects: readonly RuntimeEffect[];
  readonly executed: readonly string[];
  readonly validation?: ValidationRunResult;
  readonly watchers?: WatcherRunResult;
  readonly error?: string;
}

export interface WriteAppBindingInput {
  readonly elementKey: string;
  readonly propPath: JsonPointer;
  readonly value: unknown;
}

export interface WriteAppBindingResult {
  readonly ok: boolean;
  readonly target: JsonPointer | null;
  readonly effects: readonly RuntimeEffect[];
  readonly validation?: ValidationRunResult;
  readonly watchers?: WatcherRunResult;
  readonly error?: string;
}

export interface RuntimeEffectContext {
  readonly effects: readonly RuntimeEffect[];
  readonly spec: AppSpec;
  readonly snapshot: AppStoreSnapshot;
  readonly trigger:
    | { type: "binding"; elementKey: string; target: JsonPointer }
    | { type: "event"; elementKey: string; event: KumoEventName };
}

export interface UseUIStreamOptions {
  readonly initialSpec?: AppSpec | NestedAppSpec | CompatibleUITreeInput;
  readonly functions?: Record<string, (...args: readonly unknown[]) => unknown>;
  readonly handlers?: Record<string, CustomActionHandler>;
  readonly validators?: ValidationOptions["validators"];
  readonly onEffects?: (context: RuntimeEffectContext) => void;
}

export interface UseUIStreamReturn {
  readonly spec: AppSpec;
  readonly snapshot: AppStoreSnapshot;
  readonly expanded: ExpandedAppSpec;
  readonly status: StreamStatus;
  readonly error: string | null;
  readonly setSpec: (
    spec: AppSpec | NestedAppSpec | CompatibleUITreeInput,
  ) => void;
  readonly applyPatch: (patch: JsonPatchOp) => void;
  readonly applyPatches: (patches: readonly JsonPatchOp[]) => void;
  readonly startStream: () => void;
  readonly completeStream: () => void;
  readonly failStream: (error: string) => void;
  readonly reset: () => void;
  readonly resolveElement: (elementKey: string) => ResolvedAppElement | null;
  readonly writeBinding: (input: WriteAppBindingInput) => WriteAppBindingResult;
  readonly dispatchEvent: (event: AppRuntimeEvent) => DispatchAppEventResult;
}

export interface ChatUIMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly spec: AppSpec | null;
  readonly snapshot: AppStoreSnapshot | null;
  readonly status: Exclude<StreamStatus, "idle">;
  readonly error?: string;
}

export interface StartAssistantTurnOptions {
  readonly resetUI?: boolean;
  readonly spec?: AppSpec | NestedAppSpec | CompatibleUITreeInput;
}

export interface UseChatUIOptions extends UseUIStreamOptions {
  readonly initialMessages?: readonly ChatUIMessage[];
}

export interface UseChatUIReturn extends UseUIStreamReturn {
  readonly messages: readonly ChatUIMessage[];
  readonly activeAssistantId: string | null;
  readonly pushUserMessage: (text: string) => string;
  readonly startAssistantTurn: (options?: StartAssistantTurnOptions) => string;
  readonly appendAssistantText: (chunk: string) => void;
  readonly completeAssistantTurn: () => void;
  readonly failAssistantTurn: (error: string) => void;
  readonly clear: () => void;
}
