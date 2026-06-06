/**
 * Control-plane enforcement policy — runtime-toggleable flags (no redeploy).
 *
 * Backed by the global `MarketingPolicy` row (same singleton the operational
 * policy uses), cached briefly. Each flag falls back to its CONTROL_PLANE_*_ENFORCE
 * env var when unset in the DB, so existing env-based config keeps working until
 * you toggle from the dashboard. `cpKillSwitch` forces EVERYTHING back to shadow.
 *
 * Precedence: enforced = !killSwitch && (dbFlag ?? envFlag).
 *
 * Fail-safe: if the DB is unreachable, fall back to env (and killSwitch=false).
 */

export type ControlPlaneFlagKey = "alert" | "dispatch" | "approvals" | "selfImprove";

export interface ControlPlaneFlags {
  alert: boolean;
  dispatch: boolean;
  approvals: boolean;
  selfImprove: boolean;
  killSwitch: boolean;
}

const ENV_BY_KEY: Record<ControlPlaneFlagKey, string> = {
  alert: "CONTROL_PLANE_ALERT_ENFORCE",
  dispatch: "CONTROL_PLANE_DISPATCH_ENFORCE",
  approvals: "CONTROL_PLANE_APPROVAL_ENFORCE",
  selfImprove: "CONTROL_PLANE_SELFIMPROVE_ENFORCE",
};
const DB_FIELD_BY_KEY: Record<ControlPlaneFlagKey, string> = {
  alert: "cpAlertEnforce",
  dispatch: "cpDispatchEnforce",
  approvals: "cpApprovalEnforce",
  selfImprove: "cpSelfImproveEnforce",
};

function envFlag(key: ControlPlaneFlagKey): boolean {
  return process.env[ENV_BY_KEY[key]] === "true";
}

function envFlags(): ControlPlaneFlags {
  return {
    alert: envFlag("alert"),
    dispatch: envFlag("dispatch"),
    approvals: envFlag("approvals"),
    selfImprove: envFlag("selfImprove"),
    killSwitch: false,
  };
}

const CACHE_TTL_MS = 15_000;
let cached: { value: ControlPlaneFlags; at: number } | null = null;

interface PolicyDelegate {
  findUnique(args: { where: { platform: string }; select: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
  updateMany(args: { where: { platform: string }; data: Record<string, unknown> }): Promise<{ count: number }>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
}

export async function getControlPlaneFlags(): Promise<ControlPlaneFlags> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  try {
    const { prisma } = await import("@/lib/prisma");
    const db = prisma as unknown as { marketingPolicy: PolicyDelegate };
    const row = await db.marketingPolicy.findUnique({
      where: { platform: "global" },
      select: { cpAlertEnforce: true, cpDispatchEnforce: true, cpApprovalEnforce: true, cpSelfImproveEnforce: true, cpKillSwitch: true },
    });
    const pick = (key: ControlPlaneFlagKey): boolean => {
      const v = row?.[DB_FIELD_BY_KEY[key]];
      return v === null || v === undefined ? envFlag(key) : Boolean(v);
    };
    const value: ControlPlaneFlags = {
      alert: pick("alert"),
      dispatch: pick("dispatch"),
      approvals: pick("approvals"),
      selfImprove: pick("selfImprove"),
      killSwitch: Boolean(row?.cpKillSwitch ?? false),
    };
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return envFlags(); // DB unavailable → fall back to env, no kill switch
  }
}

/** enforced = NOT killSwitch AND the flag is on. Pure given the flags. */
export function resolveEnforced(flags: ControlPlaneFlags, key: ControlPlaneFlagKey): boolean {
  return !flags.killSwitch && flags[key];
}

export async function isAlertEnforced(): Promise<boolean> {
  return resolveEnforced(await getControlPlaneFlags(), "alert");
}
export async function isDispatchEnforced(): Promise<boolean> {
  return resolveEnforced(await getControlPlaneFlags(), "dispatch");
}
export async function isApprovalEnforced(): Promise<boolean> {
  return resolveEnforced(await getControlPlaneFlags(), "approvals");
}
export async function isSelfImproveEnforced(): Promise<boolean> {
  return resolveEnforced(await getControlPlaneFlags(), "selfImprove");
}

export function invalidateControlPlaneCache(): void {
  cached = null;
}

/**
 * Set a flag (or the kill switch) on the global policy row. value=null clears the
 * override (back to env fallback). Returns the fresh flags.
 */
export async function setControlPlaneFlag(
  key: ControlPlaneFlagKey | "killSwitch",
  value: boolean | null,
  updatedBy?: string,
): Promise<ControlPlaneFlags> {
  const field = key === "killSwitch" ? "cpKillSwitch" : DB_FIELD_BY_KEY[key];
  const { prisma } = await import("@/lib/prisma");
  const db = prisma as unknown as { marketingPolicy: PolicyDelegate };
  const data: Record<string, unknown> = { [field]: value, updatedBy: updatedBy ?? "admin" };
  const res = await db.marketingPolicy.updateMany({ where: { platform: "global" }, data });
  if (res.count === 0) {
    await db.marketingPolicy.create({ data: { platform: "global", [field]: value } }).catch(() => {});
  }
  invalidateControlPlaneCache();
  return getControlPlaneFlags();
}
