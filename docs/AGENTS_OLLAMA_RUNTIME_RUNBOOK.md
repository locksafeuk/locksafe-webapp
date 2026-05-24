# Agents Ollama Runtime Runbook

Use this runbook to prevent unexpected OpenAI credit burn after deploys, restarts, or incident recovery.

## Quick command

Run from the webapp root:

```bash
npm run verify:agents-runtime
```

This script checks:
- Public LLM failover health endpoint
- Authenticated agent runtime diag endpoint (if secret is provided)
- Admin 24h model mix endpoint (if auth token is provided)

## Required environment variables

Set these before running the command in production checks:

- VERIFY_BASE_URL: Base URL, defaults to https://www.locksafe.uk
- VERIFY_CRON_SECRET: Secret for GET /api/agents/_diag
- VERIFY_ADMIN_AUTH_TOKEN: Admin auth_token cookie value for GET /api/agents/status
- VERIFY_MIN_LOCAL_PCT: Minimum acceptable local ratio, default 90

Example:

```bash
export VERIFY_BASE_URL="https://www.locksafe.uk"
export VERIFY_CRON_SECRET="<cron-secret>"
export VERIFY_ADMIN_AUTH_TOKEN="<admin-auth-token>"
export VERIFY_MIN_LOCAL_PCT="90"
npm run verify:agents-runtime
```

## Pass criteria

- /api/health/llm-failover is not unhealthy
- /api/agents/_diag reports:
  - ollamaRuntime.enabled = true
  - chat.usedFallback = false
  - chat.model classified as local (hermes, llama, qwen, mistral, gemma, deepseek, phi)
- /api/agents/status reports:
  - system.hermesModeEnabled = true
  - llmRuntime.localPct >= VERIFY_MIN_LOCAL_PCT

## If checks fail

1. Open AI Agents admin page and verify fallback toggle state.
2. Confirm OLLAMA_BASE_URL is set and reachable from deployment runtime.
3. Confirm OLLAMA_RUNTIME_ENABLED is not false.
4. Confirm OpenAI fallback policy is not armed unless incident response requires it.
5. Check circuit safety flags:
  - AUTO_DISARM_OPENAI_FALLBACK_ON_CIRCUIT should stay true.
  - ALLOW_OPENAI_FALLBACK_DURING_CIRCUIT should stay false.
5. Re-run:

```bash
npm run verify:agents-runtime
```

## Related files

- src/lib/ollama-runtime.ts
- src/lib/llm-router.ts
- src/app/api/agents/_diag/route.ts
- src/app/api/agents/status/route.ts
- src/app/api/health/llm-failover/route.ts
