# Agent Control Plane

The deterministic "spine" of the agent system. The cognition plane (LLM/agents)
never mutates state directly — it emits **proposals**, and the control plane
**validates → classifies → executes / queues for approval / rejects → records**.

See `AGENT_AUTONOMY_REDESIGN_2026-06-06.md` (repo root) for the full design.

## Pipeline

```
propose → validate (deterministic) → classify → execute | approve | reject → record → reflect
```

- **validate** — pure per-action validators (`validators/`). The LLM proposes; code vetoes.
- **classify** — safe + valid → execute; risky + valid → approval queue; invalid → reject.
- **execute** — idempotent (`ActionIdempotency`), under a distributed lock (`AgentHeartbeatLock`).
- **record** — every proposal + decision is written to `AgentProposal` (audit), shadow-flagged.

## Modules

| File | Purpose |
|---|---|
| `types.ts` | Proposal / ActionDef / decision contracts |
| `validators/alert.ts` | deterministic alert gate (no-demand / quiet-hours / dedupe) |
| `validators/dispatch.ts` | deterministic auto-dispatch eligibility/gating |
| `registry.ts` | action registry + risk classification |
| `pipeline.ts` | validate + classify (pure) |
| `executor.ts` | execute / approve / reject + idempotency + recording |
| `runner.ts` | batch runner under the distributed lock |
| `ports.ts` | ProposalStore / LockManager / IdempotencyStore / ApprovalGateway / ExecutorRegistry / FactProvider |
| `adapters/memory.ts` | in-memory ports (tests + shadow) |
| `adapters/prisma.ts` | Prisma ports (AgentProposal / AgentHeartbeatLock / ActionIdempotency) |
| `adapters/prisma-approvals.ts` | ApprovalGateway → AgentExecution + AgentApproval + Telegram |
| `approvals/resolve.ts` | approve/reject; runs tool-backed + registered executors |
| `approvals/executors.ts` | risky executors (agent.pause/resume; more as migrated) |
| `shadow/alert-shadow.ts` | alert gate (shadow|enforce) |
| `shadow/dispatch-shadow.ts` | dispatch gate (shadow|enforce) |

## Risk classification (signed off)

**Risky** (require approval): money movement / bid changes, pause/resume an
agent, publish/pause a campaign, external email/SMS.
**Safe** (auto when valid): dispatch, notify-nearby, reads/stats, alerts.

## Feature flags (all default OFF = shadow/observe only)

| Env var | Effect when `true` |
|---|---|
| `CONTROL_PLANE_ALERT_ENFORCE` | suppress alerts the validator rejects (e.g. false "zero jobs" P1, overnight noise) |
| `CONTROL_PLANE_DISPATCH_ENFORCE` | block auto-dispatch when the validator rejects the candidate |
| `CONTROL_PLANE_APPROVAL_ENFORCE` | route every `requiresApproval` tool to the approval queue instead of executing |
| `CONTROL_PLANE_COO_DELEGATION` | COO heartbeat escalates stalled dispatch → CTO and low coverage → CMO |
| `CONTROL_PLANE_SELFIMPROVE_ENFORCE` | self-improvement runner APPLIES tuned parameter values (else shadow: suggest + record only) |

Tuning (optional): `TELEGRAM_QUIET_HOURS_START/END`, `TELEGRAM_ALERT_ERROR_COOLDOWN_MINUTES`.

## Rollout (per slice: shadow → observe → enforce)

1. Deploy (flags off). Alerts and dispatch run in **shadow**: decisions recorded
   to `AgentProposal`, nothing blocked.
2. Watch `/admin/agents/control-plane` — the **would-reject** rate and reasons.
   Confirm rejects are genuine noise / bad candidates.
3. Flip the relevant flag (alerts first, then dispatch, then approvals) in the
   env for **both** the PM2 runner and Vercel; restart.
4. Revert instantly by unsetting the flag.

Prereq after schema changes: `npx prisma generate && npm run db:push`.

## Status

- ✅ Spine: contracts, validators, registry, executor, idempotency, lock.
- ✅ Alerts: shadow + enforce gate (wired into `sendAdminAlert`).
- ✅ Dispatch: shadow + enforce gate (wired into the `autoDispatch` tool).
- ✅ Approvals: queue + Telegram notify + resolve/execute + admin API + central
  `requiresApproval` enforcement in `executeTool`.
- ✅ Observability: `/admin/agents/control-plane` dashboard + API.
- ✅ Delegation guard: deterministic anti-loop guard in `delegateTask` (self /
  circular / duplicate). See `src/agents/core/delegation-guard.ts`.
- ✅ COO→peer delegation: `src/agents/coo/escalation.ts` (flag-gated via
  `CONTROL_PLANE_COO_DELEGATION`).
- ✅ Self-improvement loop (closed): bounded parameter registry + hill-climb
  adjuster with rollback + experiment runner that measures real outcomes
  (job_completion_rate from the Job table), records every decision, and applies
  tuned values when enforced. Entry point: `POST /api/cron/self-improve` (run
  daily). `getTunedValue(key, fallback)` lets consumers read tuned values.
  Models: `TunableParameter` / `ParameterChange`.
- ✅ Tuned values wired into dispatch: the `autoDispatch` tool reads
  `getTunedValue("dispatch.minMatchScore", 70)` and
  `("dispatch.maxAutoDistanceMiles", 5)` and passes them to the validator, so an
  applied tuning changes real auto-dispatch behaviour (falls back to defaults).
- ⏳ Pending (deliberate — each needs its own integration-tested change): more
  outcome metrics (a real human-dismissal signal for alert_noise_rate);
  per-tool executors for resolved approvals beyond agent.pause/resume; per-agent
  daily budget caps in the heartbeat loop.

## Admin endpoints

- `GET /api/admin/agents/control-plane` — health + decisions + approvals snapshot.
- `GET /api/admin/agents/approvals` — pending approvals.
- `POST /api/admin/agents/approvals` — `{ approvalId, decision: "approved"|"rejected" }`.
