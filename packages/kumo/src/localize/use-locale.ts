import { useSyncExternalStore } from "react";

/**
 * Default locale used for SSR and when no other signal is available.
 */
const DEFAULT_LOCALE = "en";

/**
 * Set of active subscriber callbacks. The `MutationObserver` is created
 * lazily when the first subscriber is added and disconnected when the
 * last subscriber is removed.
 */
let subscribers: Set<() => void> | undefined;
let observer: MutationObserver | undefined;

/**
 * Read the current locale from the DOM, falling back through:
 *
 * 1. `document.documentElement.lang`
 * 2. `navigator.language`
 * 3. `"en"`
 */
function getSnapshot(): string {
  const htmlLang = document.documentElement.lang;
  if (htmlLang) return htmlLang;

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return DEFAULT_LOCALE;
}

function getServerSnapshot(): string {
  return DEFAULT_LOCALE;
}

function subscribe(callback: () => void): () => void {
  if (subscribers === undefined) {
    subscribers = new Set();
  }

  subscribers.add(callback);

  // Lazily create observer on first subscription
  if (observer === undefined) {
    observer = new MutationObserver(() => {
      if (subscribers === undefined) return;
      for (const cb of subscribers) {
        cb();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }

  return () => {
    if (subscribers === undefined) return;

    subscribers.delete(callback);

    // Disconnect observer when no subscribers remain
    if (subscribers.size === 0) {
      observer?.disconnect();
      observer = undefined;
      subscribers = undefined;
    }
  };
}

/**
 * React hook that reactively tracks the `<html lang>` attribute.
 *
 * Uses `useSyncExternalStore` with a `MutationObserver` so that components
 * re-render when the document locale changes at runtime. The observer is
 * created lazily on first subscription and cleaned up when no subscribers
 * remain.
 *
 * **Fallback chain:** `<html lang>` → `navigator.language` → `"en"`.
 *
 * During SSR the hook returns `"en"`.
 */
export function useLocale(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
