export type JobSourceType = "normal" | "auto";
export type JobSourceFilter = JobSourceType | "all";

const AUTO_CREATED_VIA = new Set(["retell_ai", "phone", "auto", "system_auto"]);

export function getJobSourceType(createdVia?: string | null): JobSourceType {
  if (!createdVia) return "normal";
  return AUTO_CREATED_VIA.has(createdVia.toLowerCase()) ? "auto" : "normal";
}

export function getJobSourceLabel(sourceType: JobSourceType): string {
  return sourceType === "auto" ? "AUTO" : "Normal";
}

export function getApplicationSourceType(input: {
  status?: string | null;
  message?: string | null;
  jobCreatedVia?: string | null;
}): JobSourceType {
  const status = (input.status || "").toLowerCase();
  const message = (input.message || "").toLowerCase();

  if (status === "admin_assigned") return "auto";
  if (message.includes("auto-dispatched") || message.includes("auto dispatch")) {
    return "auto";
  }

  return getJobSourceType(input.jobCreatedVia);
}

export function sourceMatchesFilter(
  sourceType: JobSourceType,
  filter: JobSourceFilter,
): boolean {
  return filter === "all" || sourceType === filter;
}
