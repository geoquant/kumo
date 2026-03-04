import { createUIResource } from "@mcp-ui/server";
import { z } from "zod";
import type { KumoPlaygroundMCP } from "./index.js";

const MOCK_EXECUTION_DELAY_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  agent.server.registerTool(
    "execute_create_worker",
    {
      title: "Execute Create Worker",
      description:
        "Execute the creation of a Cloudflare Worker after user confirmation.",
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        workerName: z.string().describe("Name of the Worker to create"),
      },
      outputSchema: {
        success: z.boolean(),
        workerName: z.string(),
        createdAt: z.string(),
      },
    },
    async ({ workerName }) => {
      await delay(MOCK_EXECUTION_DELAY_MS);

      const createdAt = new Date().toISOString();

      return {
        structuredContent: {
          success: true,
          workerName,
          createdAt,
        },
        content: [
          {
            type: "text" as const,
            text: `Worker "${workerName}" created successfully.`,
          },
        ],
      };
    },
  );
}
