import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type State = Record<string, never>;

export class KumoPlaygroundMCP extends McpAgent<Env, State> {
  server = new McpServer(
    {
      name: "kumo-playground",
      title: "Kumo Playground MCP",
      version: "0.0.1",
    },
    {
      capabilities: {
        tools: { listChanged: true },
      },
    },
  );

  async init() {
    // Tool registration will be added in tool-1
  }
}
