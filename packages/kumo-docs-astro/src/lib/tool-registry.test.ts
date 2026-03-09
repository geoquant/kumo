import { describe, expect, it } from "vitest";

import {
  CREATE_WORKER_SCENARIO,
  getToolPills,
  matchToolForMessage,
} from "~/lib/tool-registry";

describe("tool registry", () => {
  it("keeps create-worker eval scenario checked in", () => {
    expect(CREATE_WORKER_SCENARIO).toEqual({
      id: "create-worker",
      initialPrompt: "create a new hello world worker",
      toolName: "execute_create_worker",
      stageThresholds: {
        confirmation: 0.7,
        followup: 0.72,
        combined: 0.75,
      },
    });
  });

  it("reuses the scenario prompt for the pill preset", () => {
    expect(getToolPills()).toContainEqual({
      label: "Create worker",
      prompt: CREATE_WORKER_SCENARIO.initialPrompt,
    });
  });

  it("still matches create worker requests and derives params", () => {
    const toolMatch = matchToolForMessage("create worker named edge auth");

    expect(toolMatch).not.toBeNull();
    expect(toolMatch?.[1]).toEqual({ workerName: "edge-auth" });
    expect(toolMatch?.[0].deriveToolId(toolMatch?.[1] ?? {})).toBe(
      "create-worker-edge-auth",
    );
  });
});
