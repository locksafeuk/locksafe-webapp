# Project OS Execution Checklist

Use this checklist during implementation. Do not move to next phase until all required checks are complete.

## Phase 0 - Mission Lock

- [ ] ICP documented.
- [ ] Primary pain documented.
- [ ] Core promise documented.
- [ ] First revenue loop defined.
- [ ] Non-goals list approved.
- [ ] 30-day success metrics set.

## Phase 1 - Integration Readiness

- [ ] Dependency matrix created.
- [ ] Critical credentials verified.
- [ ] Env scope map complete (local/preview/prod).
- [ ] Account ownership/scope validated.
- [ ] Blockers assigned with owner + ETA.

## Phase 2 - Thin Vertical Slice

- [ ] One complete user flow works end-to-end.
- [ ] Admin/operator visibility available.
- [ ] Failure logs are inspectable.
- [ ] Deferred features explicitly listed.

## Phase 3 - Contract Hardening

- [ ] API request/response contracts locked.
- [ ] Event names/payload contracts locked.
- [ ] Shared config/constants centralized.
- [ ] Idempotency strategy implemented.
- [ ] DB index strategy validated (including sparse unique where needed).

## Phase 4 - Regression Gate

- [ ] Regression matrix includes historical failures.
- [ ] Happy + edge + outage + retry cases covered.
- [ ] Release thresholds defined.
- [ ] Test run evidence attached.
- [ ] Critical scenarios all passing.

## Phase 5 - Automation Activation

- [ ] Policy caps configured.
- [ ] Kill switch verified.
- [ ] Auto-approve threshold set conservatively.
- [ ] Rollout staged (manual -> partial -> broader).
- [ ] Audit trail confirmed.

## Phase 6 - Operations

- [ ] Cron jobs configured.
- [ ] Manual trigger verified for critical jobs.
- [ ] Scorecard metrics live.
- [ ] Alert routing works by severity.
- [ ] Rollback runbook tested.

## Phase 7 - Reuse Packaging

- [ ] Templates saved.
- [ ] Live snapshots captured.
- [ ] Prompt pack updated.
- [ ] Mistake ledger updated.
- [ ] Next-project quickstart generated.

## Final Launch Gate

- [ ] All phases passed.
- [ ] Risks explicitly accepted or mitigated.
- [ ] Owners assigned for first 7 days post-launch monitoring.
- [ ] Incident path and rollback owner confirmed.
