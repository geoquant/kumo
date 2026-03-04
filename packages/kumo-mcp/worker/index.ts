import { createRequestHandler } from "react-router";
import { KumoPlaygroundMCP } from "./mcp/index.js";

export { KumoPlaygroundMCP };

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return KumoPlaygroundMCP.serve("/mcp", {
        binding: "KUMO_MCP_OBJECT",
      }).fetch(request, env, ctx);
    }

    // Fall through to React Router for all other routes (iframe UI pages).
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
};
