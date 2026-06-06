const PLACEHOLDER_NAMES = new Set([
  "phone customer",
  "customer",
  "unknown",
  "there",
  "n/a",
  "na",
]);

function normalizeName(name?: string | null): string {
  return (name || "").trim();
}

export function isPlaceholderCustomerName(name?: string | null): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return true;
  return PLACEHOLDER_NAMES.has(normalized.toLowerCase());
}

export function resolveCustomerDisplayName(args: {
  primaryName?: string | null;
  fallbackName?: string | null;
  defaultName?: string;
}): string {
  const primary = normalizeName(args.primaryName);
  const fallback = normalizeName(args.fallbackName);

  if (primary && !isPlaceholderCustomerName(primary)) {
    return primary;
  }
  if (fallback && !isPlaceholderCustomerName(fallback)) {
    return fallback;
  }
  if (primary) return primary;
  if (fallback) return fallback;
  return args.defaultName || "Customer";
}
