import { KumoPlaygroundMCP } from "./mcp/index.js";

export { KumoPlaygroundMCP };

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
