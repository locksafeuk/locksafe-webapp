# Retell Retraining Runbook

This runbook is the Retell-first source of truth for training, evaluation, deployment, and rollback of LockSafe's voice receptionist.

## Scope

Covers:
- Baseline capture and KPI snapshot
- Privacy-safe dataset export
- Prompt/persona updates
- Realism tuning matrix
- Version snapshot, publish, rollback
- Human QA and simulation checks
- Experiment winner promotion
- Daily scorecard and alerting

## Prerequisites

- Admin access to LockSafe admin panel
- Retell credentials configured:
  - RETELL_API_KEY
  - RETELL_AGENT_ID
  - RETELL_WEBHOOK_SECRET
- Active voice config exists

## Phase Workflow

### 1) Baseline Snapshot

1. Call GET /api/retell/baseline
2. Save generated KPIs:
   - calls7d
   - completionRate7d
   - callToJobRate7d
   - reviewRate7d

### 2) Dataset Export

1. Create an incremental job via POST /api/retell/dataset/jobs
2. Confirm job status completed
3. Use qualityRows output for training/evaluation
4. The cron at /api/cron/voice-dataset-incremental runs every 6h and uses the resolveIncrementalDatasetWindow helper to advance the cursor from the last completed job

### 3) Prompt + Realism Update

1. Update modular prompt inputs in active config
2. Set realism profile via PUT /api/retell/realism
3. Generate and select experiment variants from returned matrix

### 4) Version Snapshot

1. Create immutable snapshot via POST /api/retell/config/versions
2. Add title + notes for traceability

### 5) Publish to Retell

1. Publish snapshot via POST /api/retell/config/versions/publish
2. Verify publishStatus=published and retellVersionId is present
3. Confirm active config now mirrors published snapshot

### 6) QA + Simulation Gate

1. Pull the prioritized review queue from GET /api/retell/qa/queue
2. Add reviewer labels/scores via POST /api/retell/reviews — payload normalized via normalizeQaReviewInput; composite score returned in response
3. Run simulation scenarios via POST /api/retell/simulations/run
4. The simulation regression suite (Emergency callback priority, SMS fallback with manual handoff, Loop termination regression) is locked by retell-simulation-regression.test.ts
5. Minimum gate:
   - passRate >= 80%
   - avg naturalness >= 3.5
   - composite QA >= 3.8

### 7) Experiment Decision

1. Create running experiment via POST /api/retell/experiments — POST validates trafficSplit (5–95), stopLossThreshold (1–50), and rejects same-version or concurrent experiments via evaluateRolloutGuardrails / ensureNoConflictingExperiment
2. Recompute summary via POST /api/retell/experiments with action=evaluate
3. Summary includes insufficientData=true when either arm has fewer than EXPERIMENT_GUARDRAILS.minCallsPerArm (20) reviews — winner is null until both arms clear the floor
4. If stop-loss triggers, keep control version
5. Promote winner version when challenger outperforms and no stop-loss

### 8) Observability + Alerts

1. Build scorecard via POST /api/retell/scorecard/daily
2. Alerts are produced by evaluateVoiceObservabilityAlerts with severity warning/critical, codes: completion_rate_low, call_to_job_rate_low, escalation_spike, naturalness_regression, no_traffic
3. Telegram notice severity escalates to critical when any critical-severity alert fires
4. Track trend via GET /api/retell/scorecard/daily?days=14

## Rollback Procedure

1. Find last stable published version in Config Versions
2. PATCH /api/retell/config/versions/deploy to disable bad deployment (if required)
3. POST /api/retell/config/versions/publish with stable versionId
4. Confirm baseline/scorecard normalizes within 24h

## Operational Cadence

- Daily: scorecard + alert triage
- Weekly: retraining data export + QA sampling
- Biweekly: simulation suite + experiment decision
- Monthly: persona and pricing review

## Audit Requirements

Each deployment must include:
- version title
- version notes
- publish timestamp
- deployedBy
- simulation pass metrics
- naturalness metric delta vs baseline
