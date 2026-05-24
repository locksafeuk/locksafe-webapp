# Project OS Prompt Pack

Copy-paste prompts for each phase of the Project OS blueprint.

Use with your coding agent at project kickoff and at every gate.

---

## Phase 0 - Mission Lock Prompt

Act as a product strategist and operating partner.

Given this idea: [INSERT IDEA]

Produce:
1. ICP definition.
2. Primary pain statement.
3. Core value promise.
4. First revenue loop (single event that proves value).
5. Non-goals for the first release.
6. A 30-day success metric set.

Constraints:
- Keep output to one page.
- Prioritize speed-to-validation over feature breadth.

---

## Phase 1 - Integration Readiness Prompt

Act as an integration architect.

For this project: [INSERT PROJECT]

Create a dependency matrix with columns:
- Integration
- Required account/access
- Required env variables
- Verification command/screen
- Risk if missing
- Status (Ready/Partial/Blocked)
- Owner
- ETA

Then output:
1. Critical path dependencies.
2. Hard blockers to start build.
3. Recommended implementation order.

---

## Phase 2 - Thin Vertical Slice Prompt

Act as a startup CTO optimizing for reliable launch.

Design one thin vertical slice for: [INSERT PROJECT]

Include:
1. End-to-end user flow.
2. Minimum backend services needed.
3. Minimum admin/operator visibility.
4. Required logs/metrics.
5. Explicitly deferred features.

Output format:
- Architecture summary
- Sequence steps
- Done criteria

---

## Phase 3 - Contract Hardening Prompt

Act as a reliability engineer.

Review this system design/code and produce:
1. API contract checklist.
2. Event naming and payload contract checklist.
3. Env/config centralization checklist.
4. Data integrity checklist (idempotency, unique constraints, sparse indexes).
5. Retry behavior checklist.

Then identify top 10 contract-drift risks and how to prevent each.

---

## Phase 4 - Regression Matrix Prompt

Act as QA lead for production systems.

Build a regression matrix for: [INSERT PROJECT]

Need at least 10 cases covering:
- Happy path
- Edge input
- Partial outage
- Duplicate/retry behavior
- Compliance/escalation behavior
- Known historical failure

For each case include:
- Scenario name
- Preconditions
- Inputs
- Expected outcome
- Failure reason if broken
- Severity

Add release thresholds:
- Min pass rate
- Critical-zero-fail requirement

---

## Phase 5 - Automation Policy Prompt

Act as risk manager for AI operations.

Define a controlled autonomy policy for: [INSERT PROJECT]

Must include:
1. Authority levels (manual, assisted, autonomous).
2. Spend/risk caps.
3. Auto-approve thresholds.
4. Kill switch behavior.
5. Alerting rules.
6. Rollback protocol.

Return a rollout ladder:
- Week 1 settings
- Week 2 settings
- Conditions to escalate authority

---

## Phase 6 - Ops Loop Prompt

Act as SRE + operations lead.

Create an operating cadence for: [INSERT PROJECT]

Include:
1. Cron catalog (job, frequency, endpoint, auth, owner).
2. Daily scorecard metrics.
3. Alert thresholds and severity routing.
4. Weekly executive summary template.
5. Incident runbook skeleton.

Also add:
- Manual verification commands for each critical job.

---

## Phase 7 - Reuse Packaging Prompt

Act as systems designer focused on reusability.

From this project implementation, produce a reusable starter kit containing:
1. Templates to keep.
2. Snapshot assets to keep.
3. Prompt library updates.
4. Mistake ledger summary.
5. Next-project quickstart checklist.

Output should be directly usable by a new team in a new repo.

---

## Red-Team Prompt (Run Before Launch)

Act as a red-team reviewer.

Try to break this launch plan by finding:
1. Missing dependency assumptions.
2. Unbounded automation risks.
3. Data consistency risks.
4. Env/deployment drift risks.
5. Monitoring blind spots.

For each finding provide:
- Severity
- Concrete failure mode
- Exact prevention control

---

## Blameless Postmortem Prompt (After Any Incident)

Act as an incident facilitator.

Given this incident summary: [INSERT]

Produce a blameless postmortem with:
1. Timeline.
2. Root cause and contributing factors.
3. Detection gaps.
4. Corrective actions.
5. Preventive controls mapped back to Project OS phases.
6. Ownership and due dates.

Keep language factual and action-oriented.
