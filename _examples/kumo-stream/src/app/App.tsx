import { useCallback, useState } from "react";
import { Button } from "@cloudflare/kumo";
import { ChatDemo } from "./ChatDemo";

export function App() {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  return (
    <div
      data-mode={isDark ? "dark" : "light"}
      className="kumo-root mx-auto max-w-[960px] p-8 px-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="m-0 text-xl font-semibold">kumo-stream</h1>
          <p className="mt-1 text-[13px] opacity-60">
            Streaming generative UI — JSONL patches build the interface
            incrementally.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleTheme}>
          {isDark ? "Light Mode" : "Dark Mode"}
        </Button>
      </div>
      <ChatDemo />
    </div>
  );
}
