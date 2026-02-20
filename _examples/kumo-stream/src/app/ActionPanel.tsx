/**
 * ActionPanel — displays a log of action events fired by interactive
 * components in the UITree. Styled to match the cross-boundary.html
 * monospace event log via cross-boundary.css classes.
 */

import { memo, useCallback, useEffect, useRef } from "react";
import type { ActionEvent } from "../core/action-handler";

// =============================================================================
// Types
// =============================================================================

export interface ActionLogEntry {
  /** ISO timestamp of when the action was dispatched */
  readonly timestamp: string;
  /** The action event payload */
  readonly event: ActionEvent;
}

interface ActionPanelProps {
  /** Action log entries to display */
  readonly entries: readonly ActionLogEntry[];
  /** Callback to clear the log */
  readonly onClear: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

/** Format ISO timestamp to a short HH:MM:SS.mmm string */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

// =============================================================================
// Sub-components
// =============================================================================

function ActionLogRow({ entry }: { readonly entry: ActionLogEntry }) {
  const { event, timestamp } = entry;
  const ts = formatTimestamp(timestamp);

  const detailParts: string[] = [];
  if (event.params != null) {
    detailParts.push(`params=${JSON.stringify(event.params)}`);
  }
  if (event.context != null) {
    detailParts.push(`ctx=${JSON.stringify(event.context)}`);
  }
  const detailStr = detailParts.length > 0 ? ` ${detailParts.join(" ")}` : "";

  const showSubmitPreview = event.actionName === "submit_form";
  const submitPreviewBody: Record<string, unknown> = {
    actionName: event.actionName,
    sourceKey: event.sourceKey,
    ...(event.params != null ? { params: event.params } : undefined),
    ...(event.context != null ? { context: event.context } : undefined),
  };

  return (
    <div className="cb-action-log-entry">
      <span className="cb-action-log-time">{ts}</span>
      <span className="cb-action-log-name">{event.actionName}</span>{" "}
      <span className="cb-action-log-source">from {event.sourceKey}</span>
      <span className="cb-action-log-detail">{detailStr}</span>
      {showSubmitPreview ? (
        <div className="cb-action-log-sim">
          {"-> POST /api/actions "}
          {JSON.stringify(submitPreviewBody)}
        </div>
      ) : null}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function ActionPanelImpl({ entries, onClear }: ActionPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  return (
    <div className="cb-action-log-panel">
      <div className="cb-action-log-header">
        <span>Action Events</span>
        <button type="button" onClick={handleClear}>
          Clear
        </button>
      </div>
      <div ref={scrollRef} className="cb-action-log">
        {entries.map((entry, i) => (
          <ActionLogRow key={i} entry={entry} />
        ))}
      </div>
    </div>
  );
}

export const ActionPanel = memo(ActionPanelImpl);
