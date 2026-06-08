# Bot simulator — spec for next session

Goal: a `/admin/whatsapp/simulator` page that lets you (or a future Claude session) chat with the locksmith WhatsApp bot interactively, *without* sending anything through Twilio. Same brain, zero cost, faster iteration than the canned-scenarios script.

## Why we need it

- `scripts/bot-training-scenarios.ts` (already built) handles **regression** — fire a known battery, eyeball any breakage.
- The simulator handles **interactive training** — try a phrasing you're worried about, see the response live, iterate on the bot's prompts/keywords without leaving the admin panel.

## UI

Route: `app/admin/whatsapp/simulator/page.tsx` (client component, protected by existing admin auth middleware).

Layout:

- **Header**: "Bot simulator" + small "no Twilio, no SMS, no charges" reassurance.
- **Identity picker** (top of page):
  - Type: locksmith / lead / customer / unknown
  - For locksmith / lead: searchable dropdown (name + phone). Default to last selected (localStorage).
  - Shows the chosen identity's resolved phone, name, id below the picker.
- **Chat panel** (middle, ~70% width):
  - Standard chat UI — sender bubbles right (your simulated message), bot bubbles left.
  - Above each bot bubble: small grey label `[adapter] handleLocksmithWhatsApp` / `[ai] handleLocksmithAIChat` / `[fallback]` so you can see which code path produced it.
  - Latency badge per response.
  - Buttons under each bot reply: 👍 / 👎 (saved to localStorage as "this is the response I want to see / don't want").
- **Side panel** (right, ~30% width):
  - **Recent conversations** (last 10 sessions saved in localStorage) with quick replay.
  - **Quick scenarios** — buttons to fire common test cases: "jobs", "earnings", "I'm offline", "what jobs do I have?", etc.
  - **Bot state** for the current identity — completeness %, availability, # pending jobs (read-only).
- **Footer**: "Save session" → POST to `/api/admin/whatsapp/simulator/save` → persists the transcript to a `BotSimulatorSession` collection for later review.

## API

`POST /api/admin/whatsapp/simulator/send`

```ts
// Request
{
  identity: { kind: "locksmith" | "lead" | "unknown", id?: string, phone: string },
  text: string,
}

// Response
{
  reply: string,
  path: "command" | "ai" | "fallback",
  latencyMs: number,
  warnings?: string[],   // e.g. "Ollama circuit is open"
}
```

Handler logic:

1. Resolve identity (DB lookup by id or phone).
2. For locksmith identities, call `handleLocksmithWhatsApp(identity, phone, text)` directly.
3. For lead identities, call the recruitment-flow handler (find or add a helper).
4. For unknown/customer, call the customer bot handler.
5. Wrap the call to capture path taken (could be a thread-local flag set inside the adapter, or by inspecting which sub-function returned non-null).
6. Return reply + metadata.

`POST /api/admin/whatsapp/simulator/save`

Persist a session for later review:

```ts
{ identityKey: string, transcript: Array<{role, text, path, ts}>, rating?: number, notes?: string }
```

Drop in `BotSimulatorSession` Prisma model — `id`, `identityKey`, `transcript` (Json), `rating`, `notes`, `createdAt`.

## Safety

- The simulator must **never** call Twilio. Verified by routing only through the bot adapters, never the send functions.
- Mutating bot commands (`available`, `offline`, `accept`, `decline`) DO touch real DB state. UI surfaces this with a red "this will change real data" pill on the input row. Confirm dialog on first mutating command per session.
- Admin auth required.

## Files to add / change

- `src/app/admin/whatsapp/simulator/page.tsx` — UI
- `src/app/api/admin/whatsapp/simulator/send/route.ts` — main handler
- `src/app/api/admin/whatsapp/simulator/save/route.ts` — persist
- `src/components/layout/AdminSidebar.tsx` — add nav entry under WhatsApp section
- `prisma/schema.prisma` — `BotSimulatorSession` model

## Estimate

~60-90 minutes. Bulk is the chat UI + the path-detection wrapping (which lets us see whether a reply came from command vs AI vs fallback — crucial for training).

## Source-of-truth for the bot logic the simulator calls into

- `src/lib/whatsapp-business.ts` — `handleIncomingMessage` (identity router)
- `src/lib/locksmith-whatsapp-adapter.ts` — `handleLocksmithWhatsApp`, `handleLocksmithAIChat`
- `src/lib/locksmith-bot.ts` — `handleLocksmithCommand` (Telegram-shared core)

Hardening recommended in `BOT_TRAINING_FINDINGS_2026-06-08.md` (intent layer, expanded greetings, conversational fillers) should land **before** the simulator — otherwise the simulator just confirms over and over that NL is brittle.
