# Project OS Blueprint

A reusable build system for launching production-grade products fast, without repeating integration and reliability mistakes.

This blueprint is based on real delivery patterns from LockSafe (voice AI, ads automation, policy-guarded autonomy, cron-driven ops, and regression gates).

## How To Use This Document

1. Start at Phase 0 and move forward in order.
2. Do not skip gates.
3. If a gate fails, roll back to the previous phase and fix root cause.
4. Log every failure in the Mistake Ledger template at the end.

---

## Phase 0 - Mission Lock

### Objective
Define the business loop before architecture.

### Required outputs
- ICP profile (who pays)
- Primary pain (what hurts)
- Core promise (what improves)
- First revenue loop (what event proves traction)
- Non-goals list

### Gate
- Everyone can state in one sentence: who this is for, what pain is solved, and what event proves success.

### Anti-patterns to avoid
- Building features before defining who buys.
- Chasing channels before proving one conversion loop.

---

## Phase 1 - Integration and Access Readiness

### Objective
Remove external blockers before coding dependencies.

### Required outputs
- Dependency matrix: API, vendor, account owner, credential state
- Environment scope map: local, preview, production
- Verification evidence for each integration (screen, command, response)

### Gate
- All critical dependencies are either Ready or explicitly Blocked with owner + ETA.

### Anti-patterns to avoid
- Assuming OAuth success means full API permission.
- Mixing account scopes (wrong Vercel team or wrong cloud project).

---

## Phase 2 - Thin Vertical Slice

### Objective
Ship one complete end-to-end path before expanding channels.

### Required outputs
- One user journey from intake to completion
- One operator/admin visibility surface
- Basic telemetry for success and failure

### Gate
- One real transaction completes without manual intervention.

### Anti-patterns to avoid
- Multi-channel rollout before one path is stable.
- UI breadth without operational depth.

---

## Phase 3 - Contract and Data Hardening

### Objective
Stabilize interfaces and data behavior.

### Required outputs
- API contract schema (request/response/errors)
- Event contract schema (names, payload shape)
- Centralized runtime config constants
- Idempotency rules for retried calls
- DB index strategy (including sparse unique edge cases)

### Gate
- No critical flow depends on implicit defaults.

### Anti-patterns to avoid
- Hardcoded contact values spread across codebase.
- Optional unique DB fields without sparse index strategy.

---

## Phase 4 - Regression Matrix and Release Gates

### Objective
Prevent known regressions before deploy.

### Required outputs
- Scenario matrix with expected outcomes
- Historical failure scenarios locked in tests
- Minimum release thresholds (quality, pass rate, operational checks)

### Gate
- Regression suite passes and includes at least one known bad case that fails intentionally.

### Anti-patterns to avoid
- Only testing happy path.
- Prompt or policy edits without regression rerun.

---

## Phase 5 - Controlled Automation Activation

### Objective
Enable autonomy safely with reversible controls.

### Required outputs
- Policy model (caps, thresholds, authority levels)
- Kill switch behavior
- Staged rollout plan (manual -> partial auto -> expanded auto)
- Audit trail for actions

### Gate
- Every automated action is attributable, capped, and reversible.

### Anti-patterns to avoid
- Full autonomy on day one.
- No budget/risk ceiling before automation.

---

## Phase 6 - Operations and Reliability Loops

### Objective
Make system stable under continuous change.

### Required outputs
- Cron schedule with ownership and purpose
- Alert thresholds and escalation rules
- Daily scorecard and weekly report
- Rollback runbook and fire-drill proof

### Gate
- Manual trigger tests pass for all critical cron endpoints.

### Anti-patterns to avoid
- Background jobs without reconciliation pass.
- Alerting without severity/ownership.

---

## Phase 7 - Reuse and Handoff Packaging

### Objective
Convert successful implementation into reusable assets.

### Required outputs
- Template library (campaigns, prompts, policies)
- Snapshot library (known-good live states)
- Prompt pack for future project kickoff
- Mistake ledger with prevention controls

### Gate
- New project can be started from these assets in under one day.

### Anti-patterns to avoid
- Finishing a project without preserving reusable structure.
- Knowledge trapped in chat history only.

---

## Top Mistakes and Preventive Controls

1. Prompt drift from repeated edits.
Control: one source-of-truth prompt file + locked regression matrix.

2. Credential readiness assumed, not verified.
Control: dependency matrix with proof step per integration.

3. Config value drift across channels.
Control: central config module consumed everywhere.

4. Overly early automation.
Control: policy caps + staged enablement + kill switch.

5. No post-publish ground truth.
Control: capture live snapshot after every publish.

6. Missing edge-case tests.
Control: historical failures must stay in test suite forever.

7. Runtime/env drift across scopes.
Control: strict env schema and environment checklist.

8. Silent retries and duplicate side effects.
Control: idempotency keys and retry contracts.

9. Cron jobs with no reconciliation safety net.
Control: pair realtime trigger with daily reconciliation job.

10. Docs lagging implementation.
Control: no merge without runbook updates.

---

## Definition of Done by Phase

- Phase 0 done: charter signed, non-goals written.
- Phase 1 done: critical dependency status is verified.
- Phase 2 done: thin vertical slice works live.
- Phase 3 done: contracts/config/data safety locked.
- Phase 4 done: regression gate green with edge cases.
- Phase 5 done: automation policy + kill switch tested.
- Phase 6 done: cron and alert loops verified.
- Phase 7 done: reusable assets documented and indexed.

---

## Mistake Ledger Template

Use this after each incident.

| Date | Symptom | Root Cause | Phase Missed | Fix Applied | Prevention Control | Owner | Status |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD | What failed | Why it failed | Which phase should have caught it | What was changed | New guardrail/test/check | Name | Open/Closed |

---

## Cross-Reference (LockSafe)

- Voice retraining lifecycle: docs/RETELL_RETRAINING_RUNBOOK.md
- Autonomous ads operator controls: docs/CMO_AUTONOMY_RUNBOOK.md
- Cron operations model: docs/CRON_JOBS_COMPLETE.md
- Prompt and scenario code anchors: src/lib/retell-prompt.ts, src/lib/retell-simulations.ts
- Campaign publish and snapshot anchors: src/lib/google-ads-publish.ts, src/lib/google-ads-snapshot.ts
