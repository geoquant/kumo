import { useCallback, useState } from "react";
import { ChatDemo } from "./ChatDemo";
import "./cross-boundary.css";

export function App() {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  return (
    <div data-mode={isDark ? "dark" : "light"} className="cb-page kumo-root">
      <div className="cb-page-inner">
        <div className="cb-header">
          <div>
            <h1>Kumo Streaming Demo</h1>
            <p> React SPA. Streaming generative UI via JSONL patches.</p>
          </div>
          <button type="button" onClick={toggleTheme}>
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
        <ChatDemo isDark={isDark} />
      </div>
    </div>
  );
}
