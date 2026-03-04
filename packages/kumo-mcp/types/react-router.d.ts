// Ambient module for React Router's virtual server build.
// Resolved at build time by the @react-router/dev Vite plugin.
// The dynamic import resolves to the build object itself.
declare module "virtual:react-router/server-build" {
  import type { ServerBuild } from "react-router";
  const serverBuild: ServerBuild;
  export = serverBuild;
}

// Vite import.meta.env types for worker context.
interface ImportMeta {
  readonly env: {
    readonly MODE: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly SSR: boolean;
    readonly [key: string]: string | boolean | undefined;
  };
}
