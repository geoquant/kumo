export function resolveAriaLabel(
  override: string | undefined,
  fallback: string,
): string {
  const trimmedOverride = override?.trim();
  if (trimmedOverride === undefined || trimmedOverride.length === 0) {
    return fallback;
  }

  return trimmedOverride;
}
