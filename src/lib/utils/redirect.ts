export function sanitizeInternalPath(
  value: string | null | undefined,
  fallback = "/admin",
) {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}
