/**
 * @a2ui-bridge/react-kumo - Utility functions
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a literal value from an A2UI property.
 * Handles both raw values and { literalString, literalNumber, literalBoolean, literal } wrappers.
 */
export function extractLiteral(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("literalString" in obj) return String(obj.literalString ?? "");
    if ("literalNumber" in obj) return String(obj.literalNumber ?? "");
    if ("literalBoolean" in obj) return String(obj.literalBoolean ?? "");
    if ("literal" in obj) return String(obj.literal ?? "");
  }
  return "";
}

export function extractBoolean(value: unknown, defaultValue = false): boolean {
  if (value == null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("literalBoolean" in obj) return Boolean(obj.literalBoolean);
  }
  return defaultValue;
}

export function extractNumber(value: unknown, defaultValue = 0): number {
  if (value == null) return defaultValue;
  if (typeof value === "number") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("literalNumber" in obj)
      return Number(obj.literalNumber ?? defaultValue);
  }
  return defaultValue;
}
