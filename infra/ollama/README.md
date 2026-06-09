# Ollama reliability + security (Mac Studio)

Production (Vercel) uses the Mac Studio's local Ollama as its primary LLM brain
(agents, content, Google Ads, dispatch ranking, the WhatsApp bot). This folder
makes that link **reliable, secure, and reboot-proof** so the ~22h silent outage
can't happen again.

## The chain

```
Vercel ──HTTPS──▶ Tailscale Funnel (:8443) ──▶ Caddy auth proxy (:11436) ──▶ Ollama (127.0.0.1:11434)
```

> **Coexistence:** this Mac also runs the **reparalo24** project, which has its
> own Caddy on `:11435` and Tailscale Funnel on `:443`. LockSafe deliberately
> uses `:11436` + `:8443` and never touches `:443`, so the two never collide.
> (An earlier version of this setup used `:11435` + `:443` and stepped on
> reparalo24 — that's fixed.)
>
> `OLLAMA_BASE_URL` in Vercel must point at the **:8443** funnel URL, e.g.
> `https://<this-mac>.<tailnet>.ts.net:8443`.

- **Caddy proxy** requires the `X-Ollama-Secret` header (the LLM router already
  sends it) and rewrites `Host` → localhost. Wrong/missing secret → `403`, so a
  leaked funnel URL is useless to anyone else. Ollama stays bound to localhost.
- **LaunchAgents** keep Caddy alive (auto-restart) and re-assert the funnel at
  every login — survives reboots.
- **Watchdog cron** (`/api/cron/llm-health-monitor`, every 30 min) Telegrams you
  while the LLM layer is unhealthy, at most once every 2h.

## Why the outage happened (root cause)

The Tailscale funnel had dropped (`No serve config`), and once restored, Ollama
returned `403` because it rejects non-localhost `Host` headers. Result: the
router's circuit breaker tripped and the whole AI layer fell back to OpenAI
(costing money) — and the parts with no fallback went fully offline.

## Setup (run once on the Mac Studio)

```bash
bash infra/ollama/setup.sh
```

It installs Caddy if needed, prompts for `OLLAMA_SECRET` (must match Vercel),
writes + loads the LaunchAgents, points the funnel at the proxy, and verifies the
chain. Idempotent — safe to re-run.

Then confirm production sees it:
`https://www.locksafe.uk/api/admin/agents/ollama-probe` → `reachable: true`
(may take ~30 min for the router's circuit breaker to retry Ollama).

## Files

| File | What it is |
|---|---|
| `Caddyfile` | Auth + Host-rewrite reverse proxy config |
| `setup.sh` | Installs/wires/loads everything (idempotent) |
| LaunchAgents (generated) | `~/Library/LaunchAgents/com.locksafe.ollama-{proxy,funnel}.plist` |

## Useful checks

```bash
# Is Ollama up locally?
curl -s http://127.0.0.1:11434/api/tags | head -c 100

# Is the funnel pointing at the proxy?
tailscale funnel status

# Proxy logs
tail -f ~/Library/Logs/locksafe-ollama-proxy.log
```
