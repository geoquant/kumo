/**
 * SubmitPanel — shows the current submit payload for a generated form.
 *
 * Mirrors the Action Events card styling so React + HTML/UMD look identical.
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { UITree, UIElement } from "../core/types";
import type { RuntimeValueStore } from "../core/runtime-value-store";

interface SubmitPanelProps {
  readonly tree: UITree;
  readonly runtimeValueStore: RuntimeValueStore;
}

function findSubmitAction(tree: UITree): {
  readonly sourceKey: string;
  readonly action: NonNullable<UIElement["action"]>;
} | null {
  for (const [key, el] of Object.entries(tree.elements)) {
    if (!el?.action) continue;
    if (el.action.name !== "submit_form") continue;
    return { sourceKey: key, action: el.action };
  }
  return null;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable]";
  }
}

function SubmitPanelImpl({ tree, runtimeValueStore }: SubmitPanelProps) {
  const submit = useMemo(() => findSubmitAction(tree), [tree]);

  const [runtimeValues, setRuntimeValues] = useState<
    Readonly<Record<string, unknown>>
  >({});

  useEffect(() => {
    const update = () => {
      setRuntimeValues(runtimeValueStore.snapshotAll());
    };

    update();
    return runtimeValueStore.subscribe(update);
  }, [runtimeValueStore]);

  const payloadText = useMemo(() => {
    if (!submit) return "";

    const body: Record<string, unknown> = {
      actionName: "submit_form",
      sourceKey: submit.sourceKey,
      context: { runtimeValues },
    };

    if (submit.action.params != null) {
      body.params = submit.action.params;
    }

    return `-> POST /api/actions\n${safeJson(body)}`;
  }, [submit, runtimeValues]);

  const handleCopy = useCallback(async () => {
    if (!payloadText) return;
    if (typeof navigator === "undefined") return;
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(payloadText);
    } catch {
      // ignore
    }
  }, [payloadText]);

  return (
    <div className="cb-submit-panel">
      <div className="cb-submit-header">
        <span>Submit Payload</span>
        <button type="button" onClick={handleCopy} disabled={!payloadText}>
          Copy
        </button>
      </div>
      <pre className="cb-submit-body">{payloadText}</pre>
    </div>
  );
}

export const SubmitPanel = memo(SubmitPanelImpl);
