export type CanonicalLocationMatchType = "PRESENCE" | "PRESENCE_OR_INTEREST";

export function normalizeLocationMatchType(value?: string | null): CanonicalLocationMatchType {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (normalized === "PRESENCE_OR_INTEREST") {
    return "PRESENCE_OR_INTEREST";
  }

  // Google Ads v24 rejects PRESENCE_ONLY for positive geo target type.
  // Any legacy/unknown value is coerced to PRESENCE.
  return "PRESENCE";
}
