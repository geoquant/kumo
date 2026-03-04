import { createUIResource } from "@mcp-ui/server";
import { z } from "zod";
import type { KumoPlaygroundMCP } from "./index.js";

/**
 * Registers all MCP tools on the agent's server.
 * Called from KumoPlaygroundMCP.init().
 */
export function initializeTools(agent: KumoPlaygroundMCP): void {
  agent.server.registerTool(
    "create_worker",
    {
      title: "Create Worker",
      description:
        "Create a new Cloudflare Worker. Returns a confirmation UI for the user to approve or cancel.",
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        workerName: z.string().describe("Name for the new Worker"),
      },
    },
    ({ workerName }) => {
      const toolId = `create-worker-${workerName}`;

      return {
        content: [
          createUIResource({
            uri: `ui://create-worker/${toolId}`,
            content: {
              type: "externalUrl",
              iframeUrl: `/ui/create-worker-confirm`,
            },
            encoding: "text",
            uiMetadata: {
              "initial-render-data": { workerName, toolId },
              "preferred-frame-size": ["100%", "280px"],
            },
          }),
        ],
      };
    },
  );
}
