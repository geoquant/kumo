import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppSpec, NestedAppSpec } from "../core";
import { useUIStream } from "./use-ui-stream";
import type {
  ChatUIMessage,
  DispatchAppEventResult,
  StartAssistantTurnOptions,
  StreamStatus,
  UseChatUIOptions,
  UseChatUIReturn,
  WriteAppBindingResult,
} from "./types";

function nextMessageId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneMessage(message: ChatUIMessage): ChatUIMessage {
  return {
    ...message,
    ...(message.spec != null
      ? {
          spec: {
            ...message.spec,
            elements: { ...message.spec.elements },
            state: { ...message.spec.state },
            ...(message.spec.meta != null
              ? { meta: { ...message.spec.meta } }
              : {}),
          },
        }
      : {}),
    ...(message.snapshot != null
      ? {
          snapshot: {
            state: { ...message.snapshot.state },
            meta: {
              validation: Object.fromEntries(
                Object.entries(message.snapshot.meta.validation).map(
                  ([path, value]) => [
                    path,
                    {
                      valid: value.valid,
                      touched: value.touched,
                      dirty: value.dirty,
                      errors: [...value.errors],
                    },
                  ],
                ),
              ),
              stream: {
                status: message.snapshot.meta.stream.status,
                ...(message.snapshot.meta.stream.lastError != null
                  ? { lastError: message.snapshot.meta.stream.lastError }
                  : {}),
              },
            },
          },
        }
      : {}),
  };
}

function upsertAssistantMessage(
  messages: readonly ChatUIMessage[],
  messageId: string,
  updater: (message: ChatUIMessage) => ChatUIMessage,
): ChatUIMessage[] {
  return messages.map((message) =>
    message.id === messageId ? updater(message) : message,
  );
}

export function useChatUI(options: UseChatUIOptions = {}): UseChatUIReturn {
  const [messages, setMessages] = useState<readonly ChatUIMessage[]>(
    () => options.initialMessages?.map(cloneMessage) ?? [],
  );
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(
    null,
  );
  const [sessionMessageId, setSessionMessageId] = useState<string | null>(
    () => {
      const assistantMessages = (options.initialMessages ?? []).filter(
        (message) => message.role === "assistant",
      );
      return assistantMessages[assistantMessages.length - 1]?.id ?? null;
    },
  );

  const activeAssistantIdRef = useRef(activeAssistantId);
  const sessionMessageIdRef = useRef(sessionMessageId);

  useEffect(() => {
    activeAssistantIdRef.current = activeAssistantId;
  }, [activeAssistantId]);

  useEffect(() => {
    sessionMessageIdRef.current = sessionMessageId;
  }, [sessionMessageId]);

  const ui = useUIStream(options);

  const syncSessionMessage = useCallback(
    (messageId: string, nextStatus: Exclude<StreamStatus, "idle">): void => {
      setMessages((previous) =>
        upsertAssistantMessage(previous, messageId, (message) => ({
          ...message,
          spec:
            ui.spec.root === "" && Object.keys(ui.spec.elements).length === 0
              ? null
              : {
                  ...ui.spec,
                  elements: { ...ui.spec.elements },
                  state: { ...ui.spec.state },
                  ...(ui.spec.meta != null
                    ? { meta: { ...ui.spec.meta } }
                    : {}),
                },
          snapshot: {
            state: { ...ui.snapshot.state },
            meta: {
              validation: Object.fromEntries(
                Object.entries(ui.snapshot.meta.validation).map(
                  ([path, value]) => [
                    path,
                    {
                      valid: value.valid,
                      touched: value.touched,
                      dirty: value.dirty,
                      errors: [...value.errors],
                    },
                  ],
                ),
              ),
              stream: {
                status: ui.snapshot.meta.stream.status,
                ...(ui.snapshot.meta.stream.lastError != null
                  ? { lastError: ui.snapshot.meta.stream.lastError }
                  : {}),
              },
            },
          },
          status: nextStatus,
          ...(ui.error != null ? { error: ui.error } : {}),
        })),
      );
    },
    [ui.error, ui.snapshot, ui.spec],
  );

  useEffect(() => {
    const messageId = sessionMessageIdRef.current;
    if (messageId == null) {
      return;
    }

    syncSessionMessage(
      messageId,
      activeAssistantIdRef.current == null ? "complete" : "streaming",
    );
  }, [activeAssistantId, syncSessionMessage, ui.error, ui.snapshot, ui.spec]);

  const pushUserMessage = useCallback((text: string): string => {
    const id = nextMessageId();
    setMessages((previous) => [
      ...previous,
      {
        id,
        role: "user",
        text,
        spec: null,
        snapshot: null,
        status: "complete",
      },
    ]);
    return id;
  }, []);

  const startAssistantTurn = useCallback(
    (turnOptions: StartAssistantTurnOptions = {}): string => {
      const existingId = activeAssistantIdRef.current;
      if (existingId != null) {
        return existingId;
      }

      if (turnOptions.resetUI) {
        ui.reset();
      }
      if (turnOptions.spec != null) {
        ui.setSpec(turnOptions.spec);
      }

      ui.startStream();

      const id = nextMessageId();
      activeAssistantIdRef.current = id;
      sessionMessageIdRef.current = id;
      setActiveAssistantId(id);
      setSessionMessageId(id);
      setMessages((previous) => [
        ...previous,
        {
          id,
          role: "assistant",
          text: "",
          spec: null,
          snapshot: null,
          status: "streaming",
        },
      ]);
      return id;
    },
    [ui],
  );

  const ensureAssistantTurn = useCallback((): string => {
    const existingId = activeAssistantIdRef.current;
    if (existingId != null) {
      return existingId;
    }
    return startAssistantTurn();
  }, [startAssistantTurn]);

  const appendAssistantText = useCallback(
    (chunk: string): void => {
      const messageId = ensureAssistantTurn();
      setMessages((previous) =>
        upsertAssistantMessage(previous, messageId, (message) => ({
          ...message,
          text: `${message.text}${chunk}`,
          status: "streaming",
        })),
      );
    },
    [ensureAssistantTurn],
  );

  const setSpec = useCallback(
    (spec: AppSpec | NestedAppSpec): void => {
      const messageId = ensureAssistantTurn();
      ui.setSpec(spec);
      syncSessionMessage(messageId, "streaming");
    },
    [ensureAssistantTurn, syncSessionMessage, ui],
  );

  const applyPatch = useCallback(
    (patch: Parameters<typeof ui.applyPatch>[0]): void => {
      const messageId = ensureAssistantTurn();
      ui.applyPatch(patch);
      syncSessionMessage(messageId, "streaming");
    },
    [ensureAssistantTurn, syncSessionMessage, ui],
  );

  const applyPatches = useCallback(
    (patches: Parameters<typeof ui.applyPatches>[0]): void => {
      const messageId = ensureAssistantTurn();
      ui.applyPatches(patches);
      syncSessionMessage(messageId, "streaming");
    },
    [ensureAssistantTurn, syncSessionMessage, ui],
  );

  const completeAssistantTurn = useCallback((): void => {
    const messageId = activeAssistantIdRef.current;
    if (messageId == null) {
      return;
    }

    ui.completeStream();
    syncSessionMessage(messageId, "complete");
    activeAssistantIdRef.current = null;
    setActiveAssistantId(null);
  }, [syncSessionMessage, ui]);

  const failAssistantTurn = useCallback(
    (error: string): void => {
      const messageId = activeAssistantIdRef.current;
      if (messageId == null) {
        return;
      }

      ui.failStream(error);
      setMessages((previous) =>
        upsertAssistantMessage(previous, messageId, (message) => ({
          ...message,
          status: "error",
          error,
        })),
      );
      activeAssistantIdRef.current = null;
      setActiveAssistantId(null);
    },
    [ui],
  );

  const clear = useCallback((): void => {
    ui.reset();
    setMessages([]);
    activeAssistantIdRef.current = null;
    sessionMessageIdRef.current = null;
    setActiveAssistantId(null);
    setSessionMessageId(null);
  }, [ui]);

  const writeBinding = useCallback(
    (input: Parameters<typeof ui.writeBinding>[0]): WriteAppBindingResult => {
      const result = ui.writeBinding(input);
      const messageId = sessionMessageIdRef.current;
      if (messageId != null) {
        syncSessionMessage(
          messageId,
          activeAssistantIdRef.current == null ? "complete" : "streaming",
        );
      }
      return result;
    },
    [syncSessionMessage, ui],
  );

  const dispatchEvent = useCallback(
    (event: Parameters<typeof ui.dispatchEvent>[0]): DispatchAppEventResult => {
      const result = ui.dispatchEvent(event);
      const messageId = sessionMessageIdRef.current;
      if (messageId != null) {
        syncSessionMessage(
          messageId,
          activeAssistantIdRef.current == null ? "complete" : "streaming",
        );
      }
      return result;
    },
    [syncSessionMessage, ui],
  );

  const reset = useCallback((): void => {
    ui.reset();
    const messageId = sessionMessageIdRef.current;
    if (messageId != null) {
      syncSessionMessage(messageId, "complete");
    }
  }, [syncSessionMessage, ui]);

  const status = useMemo(
    () => (activeAssistantId == null ? ui.status : "streaming"),
    [activeAssistantId, ui.status],
  );

  const error = useMemo(() => {
    if (activeAssistantId != null) {
      return ui.error;
    }

    const currentSessionId = sessionMessageIdRef.current;
    return (
      messages.find((message) => message.id === currentSessionId)?.error ??
      ui.error
    );
  }, [activeAssistantId, messages, ui.error]);

  return {
    ...ui,
    messages,
    activeAssistantId,
    status,
    error,
    pushUserMessage,
    startAssistantTurn,
    appendAssistantText,
    completeAssistantTurn,
    failAssistantTurn,
    clear,
    reset,
    writeBinding,
    dispatchEvent,
    setSpec,
    applyPatch,
    applyPatches,
  };
}
