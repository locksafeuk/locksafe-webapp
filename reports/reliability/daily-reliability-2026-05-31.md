# Daily Reliability Scorecard - 2026-05-31

- Timestamp (UTC): 2026-05-31T05:00:08.127Z
- Base URL: https://www.locksafe.uk
- Overall: RED
- Score: 65/100
- Result counts: PASS=6, WARN=1, FAIL=4

## Check Results

| Category | Check | Critical | Status | HTTP | Details |
|---|---|---|---|---|---|
| website | Homepage reachable | yes | PASS | 200 | Homepage returned 200 |
| website | Admin agents page reachable | yes | PASS | 200 | Admin page returned 200 |
| code | API health endpoint and DB connectivity | yes | PASS | 200 | health=healthy, database=ok |
| workflow | Marketing session endpoint | no | FAIL | 500 | Expected 200, got 500 |
| workflow | Marketing track endpoint | no | FAIL | 500 | Expected 200, got 500 |
| workflow | Public locksmith listing endpoint | yes | PASS | 200 | Locksmith listing available |
| agents | Agents API and heartbeat freshness | yes | FAIL | 401 | active=0, stale>30m=0 |
| agents | Agents task queue load | no | FAIL | 401 | pending=0, in_progress=0 |
| integrations | Telegram webhook endpoint | no | PASS | 200 | Telegram webhook endpoint reachable |
| integrations | WhatsApp webhook verification endpoint | no | PASS | 200 | WhatsApp verify endpoint reachable |
| integrations | Ollama/Hermes endpoint | yes | WARN | - | OLLAMA_BASE_URL not set |

## Action Items

- [P1] Fix failed check: Marketing session endpoint (Expected 200, got 500)
- [P1] Fix failed check: Marketing track endpoint (Expected 200, got 500)
- [P1] Fix failed check: Agents API and heartbeat freshness (active=0, stale>30m=0)
- [P1] Fix failed check: Agents task queue load (pending=0, in_progress=0)
- [P2] Review warning check: Ollama/Hermes endpoint (OLLAMA_BASE_URL not set)

## Owner Assignment Template

- CTO: [fill]
- COO: [fill]
- CMO: [fill]
- ETA to green: [fill]