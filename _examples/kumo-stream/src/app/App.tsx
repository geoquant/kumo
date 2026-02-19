import { Text } from "@cloudflare/kumo";
import { ChatDemo } from "./ChatDemo";

export function App() {
  return (
    <div data-mode="light" className="kumo-root mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Text variant="heading1">kumo-stream</Text>
        <Text variant="secondary">
          Streaming generative UI — JSONL patches build the interface
          incrementally.
        </Text>
      </div>
      <ChatDemo />
    </div>
  );
}
