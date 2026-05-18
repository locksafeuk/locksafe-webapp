/**
 * Operational Policy
 *
 * Runtime-controlled knobs for the agent orchestrator. Backed by the
 * `MarketingPolicy` row with platform="global". Values are cached briefly to
 * avoid hammering the DB during heartbeat bursts.
 *
 * Fields:
 *   - guardianModeEnabled         : when true, only guardian agents (coo, cto)
 *                                   run; all others are skipped silently.
 *   - alertSensitivity            : "all" | "workflow" | "critical" — gates
 *                                   Telegram alerts from non-workflow agents.
 *   - nonWorkflowHeartbeatMultiplier : integer >=1 that lengthens the cadence of
 *                                      non-guardian agents at dispatch time.
 */

export type AlertSensitivity = "all" | "workflow" | "critical";

export interface OperationalPolicy {
  guardianModeEnabled: boolean;
  alertSensitivity: AlertSensitivity;
  nonWorkflowHeartbeatMultiplier: number;
}

export const GUARDIAN_AGENT_NAMES = new Set(["coo", "cto"]);

const DEFAULT_POLICY: OperationalPolicy = {
  guardianModeEnabled: false,
  alertSensitivity: "workflow",
  nonWorkflowHeartbeatMultiplier: 1,
};

// Short cache to absorb bursts (heartbeat loops query repeatedly).
const CACHE_TTL_MS = 15_000;
let cached: { value: OperationalPolicy; at: number } | null = null;

function normaliseSensitivity(value: unknown): AlertSensitivity {
  const v = String(value ?? "").toLowerCase();
  if (v === "all" || v === "workflow" || v === "critical") return v;
  return DEFAULT_POLICY.alertSensitivity;
}

function normaliseMultiplier(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 24) return 24;
  return Math.floor(n);
}

export async function getOperationalPolicy(): Promise<OperationalPolicy> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.marketingPolicy.findUnique({
      where: { platform: "global" },
      select: {
        guardianModeEnabled: true,
        alertSensitivity: true,
        nonWorkflowHeartbeatMultiplier: true,
      },
    });
    const value: OperationalPolicy = row
      ? {
          guardianModeEnabled: Boolean(row.guardianModeEnabled),
          alertSensitivity: normaliseSensitivity(row.alertSensitivity),
          nonWorkflowHeartbeatMultiplier: normaliseMultiplier(row.nonWorkflowHeartbeatMultiplier),
        }
      : DEFAULT_POLICY;
    cached = { value, at: Date.now() };
    return value;
  } catch {
    // DB unavailable — fail safe to defaults (full coverage, workflow alerts).
    return DEFAULT_POLICY;
  }
}

/** Invalidate the cache. Call after writing a new policy via the admin API. */
export function invalidateOperationalPolicyCache(): void {
  cached = null;
}

export function isGuardianAgent(agentName: string): boolean {
  return GUARDIAN_AGENT_NAMES.has(agentName);
}

/**
 * Should a Telegram alert from this agent be emitted given current sensitivity?
 * - "all"      → always.
 * - "workflow" → always for guardians; non-workflow needs severity in {error,critical}.
 * - "critical" → always for guardians; non-workflow needs severity === "critical".
 */
export function shouldEmitAlert(
  agentName: string,
  severity: "info" | "warning" | "error" | "critical",
  sensitivity: AlertSensitivity,
): boolean {
  if (sensitivity === "all") return true;
  if (isGuardianAgent(agentName)) return true;
  if (sensitivity === "workflow") return severity === "error" || severity === "critical";
  return severity === "critical";
}
