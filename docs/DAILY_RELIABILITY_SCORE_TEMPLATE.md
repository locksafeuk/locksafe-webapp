# Daily Reliability Score Template

Use this exact structure for daily reliability reporting.

## 1. Header

- Date (UTC):
- Run Time (UTC):
- Environment:
- Base URL:
- Report Owner:

## 2. Overall Score

- Overall Status: GREEN | AMBER | RED
- Reliability Score: X/100
- Counts: PASS=X, WARN=X, FAIL=X

## 3. Coverage Matrix

| Domain | Checks Run | PASS | WARN | FAIL | Notes |
|---|---:|---:|---:|---:|---|
| Code / API |  |  |  |  |  |
| Website / UX |  |  |  |  |  |
| Workflow / Jobs |  |  |  |  |  |
| Agents / Automation |  |  |  |  |  |
| Integrations / Webhooks |  |  |  |  |  |

## 4. Failed Checks (P1)

List each failed check with explicit owner and ETA.

| Check | Impact | Owner | ETA | Mitigation | Evidence |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## 5. Warning Checks (P2)

| Check | Risk if ignored | Owner | ETA | Evidence |
|---|---|---|---|---|
|  |  |  |  |  |

## 6. KPI Snapshot

- Agent heartbeats healthy:
- Pending task load:
- In-progress task load:
- Key funnel status (spend/leads/CPL):
- Customer-facing critical flows status:

## 7. Decision Log

- Decision 1:
- Decision 2:
- Escalation required: YES | NO

## 8. Sign-off

- CTO reviewed:
- COO reviewed:
- CMO reviewed:
- CEO reviewed:
