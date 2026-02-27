/**
 * PlaygroundPage — full-page streaming UI playground.
 *
 * Provides a 4-tab interface (Preview, Code, Grading, System Prompt) for
 * generating, inspecting, and grading Kumo UI via the /api/chat endpoint.
 *
 * Loaded at /playground with client:load — all logic is client-side.
 * Auth is gated by ?key= query param validated against /api/chat/prompt.
 */

import { useEffect, useState } from "react";
import { Empty, Loader } from "@cloudflare/kumo";
import { LockKeyIcon } from "@phosphor-icons/react";

// =============================================================================
// Types
// =============================================================================

/**
 * Auth gate state machine:
 * - `checking`: reading ?key= from URL and validating via API
 * - `authenticated`: key valid, playground features unlocked
 * - `denied`: no key or invalid key, access restricted
 */
type AuthState = "checking" | "authenticated" | "denied";

// =============================================================================
// Auth hook
// =============================================================================

/**
 * Reads ?key= from URL on mount, validates against /api/chat/prompt.
 * Returns auth state and the validated key (null if denied).
 */
function usePlaygroundAuth(): { auth: AuthState; apiKey: string | null } {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");

    if (!key) {
      setAuth("denied");
      return;
    }

    // Validate key by hitting the prompt endpoint which requires auth.
    const controller = new AbortController();

    fetch("/api/chat/prompt", {
      headers: { "X-Playground-Key": key },
      signal: controller.signal,
    })
      .then((res) => {
        if (res.ok) {
          setApiKey(key);
          setAuth("authenticated");
        } else {
          setAuth("denied");
        }
      })
      .catch((err: unknown) => {
        // AbortError is expected on cleanup — ignore it.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAuth("denied");
      });

    return () => controller.abort();
  }, []);

  return { auth, apiKey };
}

// =============================================================================
// Component
// =============================================================================

export function PlaygroundPage() {
  const { auth, apiKey } = usePlaygroundAuth();

  return (
    <div className="flex h-screen flex-col bg-kumo-base text-kumo-default">
      {auth === "checking" && <CheckingState />}
      {auth === "denied" && <DeniedState />}
      {auth === "authenticated" && <AuthenticatedState apiKey={apiKey} />}
    </div>
  );
}

// =============================================================================
// State views
// =============================================================================

/** Spinner while key validation is in-flight. */
function CheckingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader size="lg" />
    </div>
  );
}

/** Access restricted — no key or invalid key. */
function DeniedState() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Empty
        icon={<LockKeyIcon size={32} />}
        title="Access restricted"
        description="This playground requires a valid access key. Add ?key=<your-key> to the URL to continue."
      />
    </div>
  );
}

/** Authenticated playground shell — future tasks build on this. */
function AuthenticatedState({ apiKey }: { apiKey: string | null }) {
  // apiKey is guaranteed non-null when auth === "authenticated",
  // but we keep the prop type nullable to avoid non-null assertions.
  // Future tasks (ui-3..ui-10) will use apiKey for all /api/chat requests.
  void apiKey;

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-kumo-subtle">Enter a prompt to generate UI</p>
    </div>
  );
}
