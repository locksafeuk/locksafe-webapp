# Bot training findings — 2026-06-08

First systematic test of the locksmith WhatsApp assistant, run via `scripts/bot-training-scenarios.ts` against Alexandru Iosif's identity (id `69d94f89e27c2b3323d5a731`, phone `7377555299`, chatId `+447377555299`).

## TL;DR

Slash commands are solid. Natural language is brittle — collapses to the "I didn't catch that" fallback whenever the AI layer can't be reached. The bot is **not yet safe to roll out to locksmiths in environments where Ollama is unreachable and OpenAI fallback is disabled**.

Production on Vercel currently has OpenAI emergency fallback enabled (per `SESSION_RECAP_2026-06-07_TWILIO_WHATSAPP.md`), so the live behaviour is less brittle than the local run — but the test still exposes real hardening to do before locksmith rollout.

## What works (21 scenarios, slash-command bucket)

| Input | Result |
|---|---|
| `hi`, `hello`, `help` | Full locksmith menu — clean, scannable, lists every command |
| `jobs` | "No active jobs" + dashboard link |
| `pending` | Lists pending applications with job ID / postcode / fee / ETA (e.g. `LS-MODJV9SR · EH3 6TD lockout · £33 · 18min`) |
| `earnings` | Today / week / month / pending / total / job count |
| `stats` | Rating (5.0), acceptance %, avg response, completion rate |
| `profile` | Completeness card — 75% for Alexandru, calls out missing call-out fee + DBS |
| `install` | 4-step install walkthrough |

## What breaks

### 1. Natural-language inputs degrade hard when AI is down

- `hey there 👋`, `what jobs do I have?`, `show me earnings this week`, `how am I doing?`, `is my profile complete?`, `how do I install the app?`, `what can you do?` all fall through to AI chat → Ollama unreachable + OpenAI fallback disabled → user sees the generic *"I didn't catch that. Reply help…"*
- Same for conversational fillers: `thanks`, `ok`, empty string, whitespace, `👍`

After 5 Ollama failures the circuit breaker opened, blocking all subsequent AI calls and firing a `🔴 Ollama Circuit Tripped` Telegram alert.

### 2. Greeting recognition is too narrow

Only literal `hi` / `hello` hits the menu. `hey`, `hi there`, `good morning`, `hi 👋` all need AI to handle them — and that's wrong: greetings should always work, even when AI is down.

### 3. No intent layer between text and AI

The bot has no middle layer that says *"this looks like the user wants to see their jobs / earnings / profile"*. Everything that isn't an exact slash command goes straight to AI. About 20 keyword patterns would catch most natural phrasings:

- `jobs|work|orders` → `jobs`
- `earnings|paid|money|pay` → `earnings`
- `available|online` → `available`
- `offline|busy|stop` → `offline`
- `profile|complete|missing|incomplete` → `profile`
- `install|app|download` → `install`
- `stats|rating|score|how am I doing` → `stats`
- thanks / cheers / cool / ok / 👍 → light ack

## Hardening checklist before locksmith rollout

1. **Add intent-keyword layer** in `handleLocksmithWhatsApp` *before* the AI chat fallback. Catches the 80% of natural-language asks that map cleanly to existing commands.
2. **Expand greeting matcher** (regex on the trimmed text, case-insensitive, allow emoji-only inputs).
3. **Define conversational filler set** (thanks/cheers/ok/cool/👍/etc.) → static friendly ack, no AI call needed.
4. **Confirm Vercel has `allowOpenAIFallback` enabled for severity high+** so production NL still works when Ollama is offline.
5. **Wire `/api/admin/whatsapp/health`** to fire an alert if Ollama circuit is open *and* OpenAI fallback is disabled — that combination = bot is mute.
6. **Build the simulator** (see `BOT_SIMULATOR_SPEC.md`) so ongoing testing is cheap.

## How to re-run

```bash
# Default: as Alexandru Iosif (+44 7377 555299)
npx tsx scripts/bot-training-scenarios.ts

# Override the test identity
npx tsx scripts/bot-training-scenarios.ts --phone +447XXXXXXXXX
npx tsx scripts/bot-training-scenarios.ts --id <locksmithId>

# Markdown export for review
npx tsx scripts/bot-training-scenarios.ts --md > training-results.md
```

## Real data Alexandru's record surfaced

While we're here — Alexandru's profile is **75%** complete. Missing:
- ❌ Call-out fee not set (dispatch-blocking)
- ❌ DBS check not uploaded (dispatch-blocking)

He has **2 pending applications** waiting: `LS-MODJV9SR` (Edinburgh EH3 6TD) and `LS-MODSDODS` (Aberdeen AB10 7LU), both lockouts at £33.
