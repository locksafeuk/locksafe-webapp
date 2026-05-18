# SSE → Pusher / Ably evaluation

**Status:** evaluation only — no refactor in this branch.
**Author:** automation sweep, May 2026.

## 1. Current state

LockSafe currently uses HTML5 Server-Sent Events for three live channels:

| Endpoint | Consumer | Purpose |
|---|---|---|
| `GET /api/tracking/stream?jobId=…` | `src/hooks/useLiveTracking.ts` | Pushes locksmith GPS pings to the customer's "track my locksmith" map. |
| `GET /api/notifications/stream?jobId=…` | `src/hooks/useRealtimeNotifications.ts` | Job-level customer/locksmith notifications. |
| `GET /api/notifications/broadcast?…` | `src/hooks/useJobNotifications.ts` | Broadcasts new-job offers to all eligible online locksmiths and writes routes/quote updates back. |

All three routes hold subscriber state in **module-level `Map`s** inside the
serverless function (`const connections = new Map<…>`). A `POST` to the same
route iterates that map to fan out events.

## 2. Why this is fragile on Vercel

1. **Per-instance state.** Vercel runs N independent serverless instances; a
   subscriber on instance A is invisible to a publisher on instance B. Today
   it mostly "works" only because traffic is low enough that publish and
   subscribe usually land on the same warm instance.
2. **Cold-start drops.** When an instance is recycled, every connection on it
   is dropped silently; the client reconnects but any messages emitted during
   the gap are lost (we have no replay).
3. **Vercel SSE timeouts.** Default Hobby/Pro function timeout is 60s–5min;
   long-lived SSE is supported but each connection ties up a full lambda
   instance, capping concurrency. The 30s heartbeat in
   `src/app/api/tracking/stream/route.ts` only masks the symptom.
4. **No durability / replay.** A locksmith who momentarily loses WiFi misses
   the new-job broadcast entirely.
5. **Auth is by query string.** `?jobId=…` is the only scoping; there is no
   per-subscriber authorisation check on the channel.

This is exactly the failure mode the rest of the platform has been hardening
against in Phases 1–6 (idempotency, retries, rate-limit budgets). The realtime
layer is the last place still relying on best-effort in-memory delivery.

## 3. Pusher Channels vs Ably — head-to-head

Both are managed, multi-region pub/sub services with first-class browser SDKs,
presence, and per-channel auth.

| Dimension | Pusher Channels | Ably |
|---|---|---|
| UK / EU regions | `eu` cluster (Dublin) — single region per app. | Multi-region active/active including `eu-west-1-A` & `eu-west-2-A`. |
| Free tier | 100 concurrent connections, 200k messages/day, no message history. | 6M messages/month, 200 peak channels, 2 min history on free tier. |
| Lowest paid tier | Startup: ~$49/mo → 500 conn / 1M msg/day. | Pay-as-you-go from $0 + $0.0025/1k msg → effectively cheaper at our volume. |
| History / replay | Add-on, 24h max on lower tiers. | Native, up to 72h on standard, "rewind" on connect — solves the missed-message problem above for free. |
| Presence | Yes, slot-based (counts toward connection cap). | Yes, first-class, no extra connection cost. |
| Delta compression | No. | Yes — material on GPS streams. |
| Webhook auth | HMAC + per-channel `private-` / `presence-` prefix; auth endpoint pattern. | JWT token requests; auth endpoint pattern. |
| Node SDK weight | `pusher` server ~20kB, `pusher-js` ~30kB gz. | `ably` server ~80kB, browser ~60kB gz. |
| Vercel docs | First-class example in Next.js docs. | First-class Next.js example + edge-runtime support. |
| Operational risk | Acquired by MessageBird (2020); product is stable but innovation has slowed. | Independent, actively shipping (LiveSync, LiveObjects). |
| Status page (last 90d) | 99.99% | 99.999% advertised, ~99.99% observed. |

## 4. Recommendation

**Go with Ably** for LockSafe's three SSE channels:

1. The **history/rewind** primitive directly removes our "locksmith missed the
   job offer during a 4G drop" failure mode without us implementing a replay
   buffer.
2. **Delta compression** matters on `tracking/stream` where we push GPS
   updates every few seconds; 60–80 % bandwidth reduction on mobile is real
   money saved by locksmiths.
3. **Multi-region active/active** removes the "what happens when Dublin is
   down" question Pusher leaves open.
4. **Pricing at our volume** (< 50 concurrent locksmiths, < 100k msg/day) is
   meaningfully cheaper on Ably's pay-as-you-go; we don't need to size up a
   Pusher Startup plan to get past the 100-connection free cap.
5. **Edge-runtime support** lets us move broadcast publish into a Next.js
   edge route, sidestepping the serverless cold-start window entirely.

The only reason to prefer Pusher would be if we were already paying for it
elsewhere (we aren't) or if we wanted the slightly simpler mental model — but
neither outweighs the missed-message problem on the locksmith dispatch flow.

## 5. Migration shape (no code here, just sequencing)

A future PR should:

1. Provision an Ably app called `locksafe-prod` and a separate `locksafe-dev`.
   Store `ABLY_API_KEY` (server, root key) and a publishable
   `NEXT_PUBLIC_ABLY_CLIENT_KEY` (capability-restricted) in Vercel and
   `.env.local`. Add both to `src/lib/env.ts` as optional strings first, then
   tighten to required once the migration is complete.
2. Add `POST /api/realtime/token` that issues an Ably token request scoped to
   the channels the current user is allowed to read/write. Reuse the existing
   `lib/auth` JWT to derive `clientId` and capability map:
   - Customers: `subscribe` on `job:<id>` and `tracking:<jobId>`.
   - Locksmiths: `subscribe` on `broadcast:<region>` + `job:<id>` for jobs
     they hold; `publish` on `tracking:<jobId>` for their active job.
   - Admin: wildcard subscribe under `admin:*`.
3. Replace each `useXxx` hook one at a time with the Ably React SDK, behind a
   `REALTIME_PROVIDER` env flag so we can roll forward and back.
4. Once all three hooks are migrated and validated for ≥ 7 days, delete the
   `/api/tracking/stream`, `/api/notifications/stream`, and
   `/api/notifications/broadcast` SSE routes and the in-memory `Map`s.
5. Add a synthetic check (Vercel cron) that publishes a heartbeat on a
   `health:realtime` channel every minute and a Sentry alert if the consumer
   in CI doesn't see it within 5 s.

## 6. Cost estimate

At current volume (≈ 30 active locksmiths peak, ≈ 60k msgs/day inc. GPS):

- Ably pay-as-you-go: ~$0.15/day (~$5/mo), well within the free tier
  realistically.
- Pusher Startup: $49/mo flat.

## 7. Out-of-scope (intentionally)

- WebSocket-from-scratch on Vercel: rejected — same cold-start and per-instance
  state problems as SSE, no managed durability.
- Self-hosted NATS / Redis pub/sub on Fly.io: rejected for now — adds infra
  surface area for a problem two managed vendors already solve cheaply.
- Pusher Beams (mobile push): orthogonal — we use OneSignal for that.
