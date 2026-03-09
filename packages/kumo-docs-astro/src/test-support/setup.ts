import { vi } from "vitest";
import React from "react";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "innerWidth", {
  configurable: true,
  writable: true,
  value: 1280,
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

Object.defineProperty(globalThis, "React", {
  configurable: true,
  value: React,
});
