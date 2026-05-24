# Project OS Master Copy-Paste Pack

Use this as the single starter document for any new project.

## 1) Master Operating Prompt (Copy-Paste)

You are my CTO + Product Operator + Reliability Lead.

I want to build this project: [PROJECT_NAME]
Business idea: [IDEA]
Target user: [ICP]

Work in 8 phases and do not skip gates:

Phase 0 - Mission Lock
- Produce: ICP, primary pain, core promise, first revenue loop, non-goals, 30-day success metrics.
- Gate: one-sentence clarity on user, pain, success event.

Phase 1 - Integration and Access Readiness
- Produce: dependency matrix (integration, credentials, env vars, verification, risk, owner, ETA).
- Gate: all critical dependencies Ready or explicitly Blocked with owner and ETA.

Phase 2 - Thin Vertical Slice
- Produce: one end-to-end flow from intake to completion + operator visibility.
- Gate: one real transaction works without manual intervention.

Phase 3 - Contract and Data Hardening
- Produce: API and event contracts, centralized config/constants, idempotency policy, DB index strategy.
- Gate: no critical flow depends on hidden defaults.

Phase 4 - Regression Matrix and Release Gate
- Produce: 10+ test scenarios including known historical failure cases.
- Gate: critical-zero-fail + pass-rate threshold met.

Phase 5 - Controlled Automation Activation
- Produce: authority levels, caps, auto-approve thresholds, kill switch, rollback protocol.
- Gate: every automated action is attributable, capped, and reversible.

Phase 6 - Operations and Reliability Loops
- Produce: cron catalog, scorecards, alerts, weekly report, incident runbook.
- Gate: manual trigger test passes for critical jobs.

Phase 7 - Reuse and Handoff Packaging
- Produce: templates, snapshots, prompt pack updates, mistake ledger, next-project quickstart.
- Gate: next project can start from artifacts in under one day.

Also include for each phase:
- top 3 risks
- anti-patterns to avoid
- definition of done
- owner and ETA

Output format:
1. Executive summary
2. Phase-by-phase plan
3. Dependency order
4. Prompt pack to execute each phase
5. Launch readiness checklist
6. Mistake ledger starter table

---

## 2) Prompt Pack (Phase-by-Phase)

### Phase 0 Prompt
Act as a product strategist and operating partner.
Given this idea: [INSERT IDEA]
Produce ICP, primary pain, core value promise, first revenue loop, non-goals, and 30-day metrics.
Keep it to one page and prioritize speed-to-validation.

### Phase 1 Prompt
Act as an integration architect.
Create a dependency matrix with: integration, required account/access, required env vars, verification command/screen, risk if missing, status, owner, ETA.
Then list critical path blockers and implementation order.

### Phase 2 Prompt
Act as a startup CTO optimizing for reliable launch.
Design one thin vertical slice for [PROJECT].
Include end-to-end user flow, minimum backend services, admin visibility, required logs/metrics, and deferred features.

### Phase 3 Prompt
Act as a reliability engineer.
Generate hardening checklists for API contracts, event contracts, env/config centralization, idempotency, unique/sparse index pitfalls, and retry behavior.
Then list top 10 contract-drift risks with prevention controls.

### Phase 4 Prompt
Act as QA lead.
Create a regression matrix with at least 10 cases covering happy path, edge inputs, partial outage, duplicate/retry behavior, compliance/escalation behavior, and historical known failures.
Include release thresholds.

### Phase 5 Prompt
Act as AI risk manager.
Design a controlled autonomy policy including authority levels, spend/risk caps, auto-approve thresholds, kill switch behavior, alerting rules, rollback protocol, and week-by-week rollout ladder.

### Phase 6 Prompt
Act as SRE + Ops lead.
Create operating cadence: cron catalog, daily scorecard metrics, alert thresholds, weekly summary template, incident runbook, and manual verification commands for critical jobs.

### Phase 7 Prompt
Act as systems designer focused on reusability.
Produce starter kit: templates to keep, snapshots to keep, prompt updates, mistake ledger summary, and next-project quickstart checklist.

### Red-Team Prompt
Act as a red-team reviewer.
Try to break the launch plan and find missing dependencies, unbounded automation risks, data consistency risks, env/deployment drift risks, and monitoring blind spots.
Provide severity, concrete failure mode, and exact prevention control for each.

### Blameless Postmortem Prompt
Act as incident facilitator.
Given incident summary [INSERT], produce timeline, root cause, contributing factors, detection gaps, corrective actions, preventive controls mapped to phases, owners, and due dates.

---

## 3) Top 10 Mistakes and Preventive Controls

1. Prompt drift from repeated patching.
- Prevention: one source-of-truth prompt file + locked regression suite.

2. Building integrations before access readiness.
- Prevention: dependency matrix and proof-based verification first.

3. Hardcoded values spread across channels.
- Prevention: centralized config/constants module.

4. Enabling autonomy too early.
- Prevention: policy caps, staged rollout, kill switch.

5. No post-publish source-of-truth snapshot.
- Prevention: capture live state immediately after publish.

6. Missing edge-case regression coverage.
- Prevention: lock historical failures in test suite permanently.

7. Env drift across local/preview/prod.
- Prevention: strict env schema + environment checklist.

8. Duplicate side effects under retries.
- Prevention: idempotency keys + retry contracts.

9. Background jobs with no reconciliation safety net.
- Prevention: pair realtime trigger with daily reconciliation cron.

10. Documentation lagging implementation.
- Prevention: no merge without runbook update.

---

## 4) Execution Checklist

### Phase 0
- [ ] ICP documented
- [ ] Primary pain documented
- [ ] Core promise documented
- [ ] First revenue loop defined
- [ ] Non-goals approved
- [ ] 30-day metrics set

### Phase 1
- [ ] Dependency matrix created
- [ ] Critical credentials verified
- [ ] Env scope map complete
- [ ] Ownership/scope validated
- [ ] Blockers assigned with owner + ETA

### Phase 2
- [ ] One flow works end-to-end
- [ ] Admin/operator visibility available
- [ ] Failure logs inspectable
- [ ] Deferred features listed

### Phase 3
- [ ] API contracts locked
- [ ] Event contracts locked
- [ ] Config centralized
- [ ] Idempotency implemented
- [ ] DB index strategy validated

### Phase 4
- [ ] Regression matrix includes historical failures
- [ ] Happy/edge/outage/retry covered
- [ ] Release thresholds defined
- [ ] Test evidence attached
- [ ] Critical scenarios passing

### Phase 5
- [ ] Policy caps configured
- [ ] Kill switch verified
- [ ] Auto-approve threshold conservative
- [ ] Staged rollout configured
- [ ] Audit trail confirmed

### Phase 6
- [ ] Cron jobs configured
- [ ] Manual trigger tests pass
- [ ] Scorecard live
- [ ] Alert routing by severity works
- [ ] Rollback runbook tested

### Phase 7
- [ ] Templates saved
- [ ] Snapshots captured
- [ ] Prompt pack updated
- [ ] Mistake ledger updated
- [ ] Quickstart generated

Final Launch Gate
- [ ] All phases passed
- [ ] Risks accepted/mitigated
- [ ] First-7-day monitoring owners assigned
- [ ] Incident + rollback owner confirmed

---

## 5) Mistake Ledger Template

| Date | Symptom | Root Cause | Phase Missed | Fix Applied | Prevention Control | Owner | Status |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD | What failed | Why it failed | Which phase should have caught it | What changed | New guardrail/test/check | Name | Open/Closed |

---

## 6) Reuse Rule

At project close, archive:
1. Best-performing templates.
2. Known-good snapshots.
3. Final prompts and policies.
4. Top incident learnings and controls.

If these are missing, the project is not complete.
