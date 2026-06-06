/**
 * Tests for the control-plane safety surface: validators + pipeline decisions.
 * These are pure functions, so the tests are fast and deterministic.
 */

import { validateAlertRaise, type AlertFacts, type AlertRaiseArgs } from "../validators/alert";
import { validateDispatchAuto, type DispatchAutoArgs } from "../validators/dispatch";
import { classify, evaluateProposal } from "../pipeline";
import type { Proposal } from "../types";

const baseAlertFacts: AlertFacts = {
  openJobCount: 0,
  recentJobCount24h: 0,
  withinQuietHours: false,
  recentlySentSameAlert: false,
  bypassQuietHours: false,
};

const businessZeroJobs: AlertRaiseArgs = {
  severity: "error",
  kind: "business",
  title: "P1: Zero completed jobs today",
  message: "0/0 completions despite 82% utilization",
  claimsZeroJobs: true,
};

describe("validateAlertRaise", () => {
  it("blocks the zero-jobs P1 when there is no demand (the 3am spam)", () => {
    const r = validateAlertRaise(businessZeroJobs, baseAlertFacts);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("no-demand");
  });

  it("allows a zero-jobs alert when there IS unmet demand", () => {
    const r = validateAlertRaise(businessZeroJobs, { ...baseAlertFacts, openJobCount: 3 });
    expect(r.ok).toBe(true);
  });

  it("suppresses duplicates", () => {
    const r = validateAlertRaise(businessZeroJobs, { ...baseAlertFacts, openJobCount: 3, recentlySentSameAlert: true });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("duplicate");
  });

  it("holds non-infra alerts during quiet hours", () => {
    const args: AlertRaiseArgs = { severity: "warning", kind: "business", title: "CPC high", message: "CPC £30" };
    const r = validateAlertRaise(args, { ...baseAlertFacts, openJobCount: 5, withinQuietHours: true });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("quiet-hours");
  });

  it("lets verified infra page during quiet hours", () => {
    const args: AlertRaiseArgs = { severity: "error", kind: "infra", title: "DB critical", message: "error rate 12%" };
    const r = validateAlertRaise(args, { ...baseAlertFacts, withinQuietHours: true, bypassQuietHours: true });
    expect(r.ok).toBe(true);
  });
});

const goodCandidate = {
  locksmithId: "ls1",
  isVerified: true,
  isActive: true,
  isAvailable: true,
  distanceMiles: 1.2,
  rating: 4.7,
  matchScore: 88,
  hasAssessmentFeeSet: true,
};

describe("validateDispatchAuto", () => {
  it("approves a strong, close, available, fee-set candidate on a pending job", () => {
    const args: DispatchAutoArgs = { jobId: "j1", jobStatus: "PENDING", candidate: goodCandidate };
    expect(validateDispatchAuto(args).ok).toBe(true);
  });

  it.each([
    [{ jobStatus: "COMPLETED" }, "job-not-pending"],
    [{ candidate: null }, "no-candidate"],
    [{ candidate: { ...goodCandidate, isVerified: false } }, "locksmith-not-eligible"],
    [{ candidate: { ...goodCandidate, isAvailable: false } }, "locksmith-unavailable"],
    [{ candidate: { ...goodCandidate, matchScore: 50 } }, "below-min-score"],
    [{ candidate: { ...goodCandidate, rating: 3.6 } }, "below-min-rating"],
    [{ candidate: { ...goodCandidate, distanceMiles: 9 } }, "too-far"],
    [{ candidate: { ...goodCandidate, hasAssessmentFeeSet: false } }, "no-assessment-fee"],
  ])("rejects when %o -> %s", (override, code) => {
    const args = { jobId: "j1", jobStatus: "PENDING", candidate: goodCandidate, ...(override as object) } as DispatchAutoArgs;
    const r = validateDispatchAuto(args);
    expect(r.ok).toBe(false);
    expect(r.code).toBe(code);
  });
});

describe("pipeline classify", () => {
  it("safe + valid -> execute", () => {
    expect(classify("safe", { ok: true })).toEqual({ decision: "execute", risk: "safe" });
  });
  it("risky + valid -> approve (never auto-execute)", () => {
    expect(classify("risky", { ok: true })).toEqual({ decision: "approve", risk: "risky" });
  });
  it("invalid -> reject regardless of risk", () => {
    expect(classify("safe", { ok: false, code: "x", reason: "y" }).decision).toBe("reject");
  });
});

describe("evaluateProposal", () => {
  const ctx = { now: new Date(), facts: { ...baseAlertFacts, openJobCount: 0, recentJobCount24h: 0 } };

  it("rejects unknown action types (LLM cannot invent mutations)", () => {
    const p: Proposal = { id: "1", agent: "cto", actionType: "delete.everything", args: {}, rationale: "", proposedAt: "" };
    const out = evaluateProposal(p, ctx);
    expect(out.decision.decision).toBe("reject");
    expect((out.decision as { code: string }).code).toBe("unknown-action");
  });

  it("routes a risky comms.email to approval", () => {
    const p: Proposal = { id: "2", agent: "cmo", actionType: "comms.email", args: { to: "x@y.com", template: "promo" }, rationale: "", proposedAt: "" };
    expect(evaluateProposal(p, ctx).decision.decision).toBe("approve");
  });

  it("rejects the false zero-jobs alert end-to-end", () => {
    const p: Proposal = { id: "3", agent: "cto", actionType: "alert.raise", args: businessZeroJobs as unknown as Record<string, unknown>, rationale: "", proposedAt: "" };
    const out = evaluateProposal(p, ctx);
    expect(out.decision.decision).toBe("reject");
  });
});
