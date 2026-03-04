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
    // Tool registration will be added in scaffold-2
  }
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return KumoPlaygroundMCP.serve("/mcp", {
        binding: "KUMO_MCP_OBJECT",
      }).fetch(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
