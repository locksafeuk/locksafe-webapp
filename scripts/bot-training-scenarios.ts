/**
 * Bot training scenarios — fires canned messages through the locksmith
 * WhatsApp assistant without going through Twilio.
 *
 * Calls `handleLocksmithWhatsApp` directly with a known locksmith identity.
 * Default: a phone number registered to a real locksmith record (Alexandru
 * Iosif's +44 7377 555299). Override with `--phone +447XXX`.
 *
 * Read-only by design: all default scenarios use commands that don't mutate
 * (jobs, pending, earnings, stats, profile, install, plus natural-language
 * queries). Mutating commands (available/offline, accept/decline) are
 * documented but commented out — uncomment and re-run with eyes open.
 *
 *   npx tsx scripts/bot-training-scenarios.ts
 *   npx tsx scripts/bot-training-scenarios.ts --phone +447377555299
 *   npx tsx scripts/bot-training-scenarios.ts --md > training-results.md
 */
import { PrismaClient } from "@prisma/client";
import { handleLocksmithWhatsApp } from "../src/lib/locksmith-whatsapp-adapter";

const prisma = new PrismaClient();

// ---- CLI args ----
const argv = process.argv.slice(2);
function flagValue(name: string, fallback?: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return fallback;
  return argv[idx + 1];
}
const TEST_PHONE = flagValue("--phone", "+447377555299") ?? "+447377555299";
const TEST_ID = flagValue("--id");
const MD = argv.includes("--md");

// ---- Scenarios ----
type Scenario = {
  group: string;
  input: string;
  note?: string;
};

const SCENARIOS: Scenario[] = [
  // Greetings & small talk
  { group: "Greeting", input: "hi" },
  { group: "Greeting", input: "hello" },
  { group: "Greeting", input: "hey there 👋" },

  // Slash-style commands (locksmith bot's core API)
  { group: "Command", input: "jobs", note: "list assigned jobs" },
  { group: "Command", input: "pending", note: "pending callbacks" },
  { group: "Command", input: "earnings", note: "earnings summary" },
  { group: "Command", input: "stats", note: "stats summary" },
  { group: "Command", input: "profile", note: "completeness card" },
  { group: "Command", input: "install", note: "install walkthrough" },

  // Natural language equivalents — exercises AI free-text fallback
  { group: "Natural language", input: "what jobs do I have?" },
  { group: "Natural language", input: "show me earnings this week" },
  { group: "Natural language", input: "how am I doing?" },
  { group: "Natural language", input: "is my profile complete?" },
  { group: "Natural language", input: "how do I install the app?" },

  // Help / discovery
  { group: "Help", input: "help" },
  { group: "Help", input: "what can you do?" },

  // Edge cases
  { group: "Edge", input: "" },
  { group: "Edge", input: "   " },
  { group: "Edge", input: "👍" },
  { group: "Edge", input: "thanks" },
  { group: "Edge", input: "ok" },

  // Mutating — UNCOMMENT WITH CARE
  // { group: "Mutating", input: "available", note: "toggles status to available" },
  // { group: "Mutating", input: "offline", note: "toggles status to offline" },
];

// ---- Pretty printing ----
function printHeader(s: string) {
  if (MD) console.log(`\n## ${s}\n`);
  else console.log(`\n\x1b[1;36m=== ${s} ===\x1b[0m`);
}
function printScenario(idx: number, total: number, s: Scenario) {
  if (MD) {
    console.log(`### ${idx}/${total} · ${s.group}${s.note ? ` — ${s.note}` : ""}`);
    console.log("");
    console.log("**Input:**");
    console.log("");
    console.log(`> \`${s.input || "(empty)"}\``);
    console.log("");
    console.log("**Bot response:**");
    console.log("");
  } else {
    console.log(`\n\x1b[1;33m[${idx}/${total}] ${s.group}${s.note ? " — " + s.note : ""}\x1b[0m`);
    console.log(`  IN  → ${JSON.stringify(s.input)}`);
  }
}
function printResponse(text: string) {
  if (MD) {
    console.log("```");
    console.log(text);
    console.log("```");
    console.log("");
  } else {
    const indented = text
      .split("\n")
      .map((l) => "      " + l)
      .join("\n");
    console.log("  OUT ↓");
    console.log(indented);
  }
}
function printError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (MD) {
    console.log("**❌ Error:** `" + msg + "`\n");
  } else {
    console.log("  \x1b[1;31mERR ✗ " + msg + "\x1b[0m");
  }
}

// ---- Main ----
async function main() {
  // Look up the test locksmith — either by explicit id, or by matching phone /
  // whatsappChatId on the digit fragments. DB stores phones in many formats
  // (bare 10-digit "7377555299", UK 07…, +44…, with spaces, etc.) so we match
  // on the last 9 significant digits.
  let exact: { id: string; name: string; phone: string; whatsappChatId: string | null } | undefined;

  if (TEST_ID) {
    const direct = await prisma.locksmith.findUnique({
      where: { id: TEST_ID },
      select: { id: true, name: true, phone: true, whatsappChatId: true },
    });
    if (!direct) {
      console.error(`❌ No locksmith with id=${TEST_ID}.`);
      process.exit(1);
    }
    exact = direct;
  } else {
    const digits = TEST_PHONE.replace(/\D/g, "");
    const tail9 = digits.slice(-9); // significant subscriber digits

    const candidates = await prisma.locksmith.findMany({
      where: {
        OR: [
          { phone: { contains: tail9 } },
          { whatsappChatId: { contains: tail9 } },
        ],
      },
      select: { id: true, name: true, phone: true, whatsappChatId: true },
      take: 10,
    });
    exact = candidates.find((l) => {
      const pd = (l.phone || "").replace(/\D/g, "");
      const cd = (l.whatsappChatId || "").replace(/\D/g, "");
      return pd.endsWith(tail9) || cd.endsWith(tail9);
    });

    if (!exact) {
      console.error(`❌ No locksmith found matching phone ${TEST_PHONE} (tail digits ${tail9}).`);
      console.error("   Candidates inspected:");
      for (const c of candidates) console.error(`     ${c.name}  phone=${c.phone}  chat=${c.whatsappChatId}  id=${c.id}`);
      console.error("\n   Override with: --id <locksmithId>");
      process.exit(1);
    }
  }

  printHeader(`Bot training scenarios · acting as ${exact.name} (${exact.phone})`);
  if (!MD) {
    console.log(`Locksmith id: ${exact.id}`);
    console.log(`whatsappChatId on file: ${exact.whatsappChatId ?? "(null — will be registered on first message in production)"}`);
    console.log(`Total scenarios: ${SCENARIOS.length}`);
  }

  const identity = {
    kind: "locksmith" as const,
    id: exact.id,
    name: exact.name,
    // Pass non-null so the adapter does NOT call registerLocksmithChat
    // (which would mutate the DB). Use TEST_PHONE as a stand-in.
    whatsappChatId: exact.whatsappChatId ?? TEST_PHONE,
  };

  let i = 0;
  for (const s of SCENARIOS) {
    i += 1;
    printScenario(i, SCENARIOS.length, s);
    try {
      const reply = await handleLocksmithWhatsApp(identity, TEST_PHONE, s.input);
      printResponse(reply);
    } catch (err) {
      printError(err);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
