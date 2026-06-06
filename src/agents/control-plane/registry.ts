/**
 * Action Registry — the single source of truth for every action an agent can
 * request. Each entry declares its risk class (drives auto-exec vs approval),
 * a deterministic validator, and an idempotency key.
 *
 * Risky set (signed off): money movement / bid changes, pause/resume an agent,
 * publish/pause a campaign, external email/SMS. Everything else is safe.
 *
 * Validators for alert.raise and dispatch.auto are fully implemented. Risky
 * actions currently use a permissive validator because the APPROVAL GATE is
 * their safety mechanism — they never auto-execute. Their dedicated validators
 * are filled in as each action is migrated onto the spine.
 */

import type { ActionContext, ActionDef, RiskClass, ValidationResult } from "./types";
import { validateAlertRaise, type AlertFacts, type AlertRaiseArgs } from "./validators/alert";
import { validateDispatchAuto, type DispatchAutoArgs } from "./validators/dispatch";

/** Normalise a string for stable idempotency keys (strip numbers/ids). */
export function normaliseForKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\b/g, "#")
    .replace(/\b[a-f0-9]{6,}\b/gi, "{id}")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const alwaysValid = (): ValidationResult => ({ ok: true });

function jsonKey(prefix: string, args: Record<string, unknown>): string {
  return `${prefix}:${normaliseForKey(JSON.stringify(args ?? {}))}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ACTIONS: ActionDef<any>[] = [
  // ── SAFE: auto-execute when valid ──
  {
    type: "alert.raise",
    risk: "safe",
    reversible: false,
    validate: (args: AlertRaiseArgs, ctx: ActionContext) =>
      validateAlertRaise(args, (ctx.facts ?? {}) as unknown as AlertFacts),
    idempotencyKey: (args: AlertRaiseArgs) => `alert.raise:${normaliseForKey(args.title)}`,
  },
  {
    type: "dispatch.auto",
    risk: "safe",
    reversible: true, // the created application can be withdrawn
    validate: (args: DispatchAutoArgs) => validateDispatchAuto(args),
    idempotencyKey: (args: DispatchAutoArgs) => `dispatch.auto:${args.jobId}`,
  },
  {
    type: "notify.nearby",
    risk: "safe",
    reversible: false,
    validate: alwaysValid,
    idempotencyKey: (args: { jobId: string }) => `notify.nearby:${args.jobId}`,
  },

  // ── RISKY: validated, then queued for approval (never auto-executed) ──
  {
    type: "campaign.publish",
    risk: "risky",
    reversible: true,
    validate: alwaysValid, // TODO: stage gate + spend-cap validator on migration
    idempotencyKey: (args: { draftId?: string }) =>
      args?.draftId ? `campaign.publish:${args.draftId}` : jsonKey("campaign.publish", args),
  },
  {
    type: "campaign.pause",
    risk: "risky",
    reversible: true,
    validate: alwaysValid,
    idempotencyKey: (args: { campaignId?: string }) =>
      args?.campaignId ? `campaign.pause:${args.campaignId}` : jsonKey("campaign.pause", args),
  },
  {
    type: "ads.bid.change",
    risk: "risky",
    reversible: true,
    validate: alwaysValid, // TODO: spend-cap / DailySpendLedger validator
    idempotencyKey: (args: { campaignId?: string }) =>
      args?.campaignId ? `ads.bid.change:${args.campaignId}` : jsonKey("ads.bid.change", args),
  },
  {
    type: "agent.pause",
    risk: "risky",
    reversible: true,
    validate: alwaysValid, // TODO: require >=3 recent failures (mirror controlAgentHeartbeatTool)
    idempotencyKey: (args: { agentName?: string }) => `agent.pause:${args?.agentName ?? "?"}`,
  },
  {
    type: "agent.resume",
    risk: "risky",
    reversible: true,
    validate: alwaysValid,
    idempotencyKey: (args: { agentName?: string }) => `agent.resume:${args?.agentName ?? "?"}`,
  },
  {
    type: "comms.email",
    risk: "risky",
    reversible: false,
    validate: alwaysValid,
    idempotencyKey: (args: { to?: string; template?: string }) =>
      `comms.email:${args?.to ?? "?"}:${args?.template ?? "?"}`,
  },
  {
    type: "comms.sms",
    risk: "risky",
    reversible: false,
    validate: alwaysValid,
    idempotencyKey: (args: { to?: string; template?: string }) =>
      `comms.sms:${args?.to ?? "?"}:${args?.template ?? "?"}`,
  },
];

const REGISTRY = new Map<string, ActionDef>(ACTIONS.map((a) => [a.type, a]));

export function getAction(type: string): ActionDef | undefined {
  return REGISTRY.get(type);
}

export function isKnownAction(type: string): boolean {
  return REGISTRY.has(type);
}

export function listActions(): Array<{ type: string; risk: RiskClass; reversible: boolean }> {
  return ACTIONS.map((a) => ({ type: a.type, risk: a.risk, reversible: a.reversible }));
}
