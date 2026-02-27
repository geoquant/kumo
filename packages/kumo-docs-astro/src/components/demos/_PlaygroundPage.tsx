/**
 * PlaygroundPage �� full-page streaming UI playground.
 *
 * Provides a 4-tab interface (Preview, Code, Grading, System Prompt) for
 * generating, inspecting, and grading Kumo UI via the /api/chat endpoint.
 *
 * Loaded at /playground with client:load — all logic is client-side.
 * Auth is gated by ?key= query param (see ui-2).
 */

export function PlaygroundPage() {
  return (
    <div className="flex h-screen flex-col bg-kumo-base text-kumo-default">
      <div className="flex flex-1 items-center justify-center">
        <p className="text-kumo-subtle">Enter a prompt to generate UI</p>
      </div>
    </div>
  );
}
