/**
 * ActionPanel — displays a log of action events fired by interactive
 * components in the UITree. Styled as a monospace event log with timestamps,
 * action names, source keys, and simulated POST lines.
 */

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@cloudflare/kumo";
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

/** Build a compact JSON payload for the simulated POST line */
function buildPostPayload(event: ActionEvent): string {
  const payload: Record<string, unknown> = {
    action: event.actionName,
    source: event.sourceKey,
  };
  if (event.params != null) {
    payload.params = event.params;
  }
  if (event.context != null) {
    payload.context = event.context;
  }
  return JSON.stringify(payload);
}

// =============================================================================
// Sub-components
// =============================================================================

function ActionLogRow({ entry }: { readonly entry: ActionLogEntry }) {
  const { event, timestamp } = entry;
  const ts = formatTimestamp(timestamp);

  return (
    <div className="border-b border-kumo-line pb-2">
      {/* Main line: timestamp + action name + source key */}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-kumo-subtle">{ts}</span>
        <span className="font-semibold text-kumo-warning">
          {event.actionName}
        </span>
        <span className="text-kumo-subtle">key={event.sourceKey}</span>
      </div>

      {/* Params/context detail (if present) */}
      {(event.params != null || event.context != null) && (
        <div className="mt-0.5 pl-4 text-kumo-subtle">
          {event.params != null && (
            <span>params={JSON.stringify(event.params)} </span>
          )}
          {event.context != null && (
            <span>ctx={JSON.stringify(event.context)}</span>
          )}
        </div>
      )}

      {/* Simulated POST line */}
      <div className="mt-0.5 pl-4 text-kumo-muted opacity-50">
        {"->"} POST /api/actions {buildPostPayload(event)}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ActionPanel({ entries, onClear }: ActionPanelProps) {
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
    <div className="flex flex-col rounded-lg border border-kumo-line overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-kumo-line bg-kumo-elevated px-3 py-2">
        <span className="text-[13px] font-semibold text-kumo-default">
          Action Events
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={entries.length === 0}
        >
          Clear
        </Button>
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        className="max-h-[200px] overflow-y-auto p-3 font-mono text-xs"
      >
        {entries.length === 0 ? (
          <p className="text-kumo-muted">
            No action events yet. Interact with a generated UI to see events
            here.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => (
              <ActionLogRow key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
