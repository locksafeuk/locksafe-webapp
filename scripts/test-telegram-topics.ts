/**
 * Live test: post one message to each of the 9 TELEGRAM_TOPIC_* threads to
 * prove the IDs are valid and bot has permission. Mirrors production routing.
 */

export {};

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!TOKEN || !CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env");
  process.exit(1);
}

const TOPICS: Record<string, number | undefined> = {
  TELEGRAM_TOPIC_NEW_JOBS: 300,
  TELEGRAM_TOPIC_LOCKSMITHS: 301,
  TELEGRAM_TOPIC_CUSTOMERS: 302,
  TELEGRAM_TOPIC_JOB_UPDATES: 303,
  TELEGRAM_TOPIC_PAYMENTS: 304,
  TELEGRAM_TOPIC_AGENTS: 305,
  TELEGRAM_TOPIC_APPLICATIONS: 306,
  TELEGRAM_TOPIC_QUOTES: 307,
  TELEGRAM_TOPIC_REVIEWS: 308,
};

async function send(name: string, threadId: number) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_thread_id: threadId,
      text: `🧪 Routing test → ${name} (thread ${threadId})\nIf you see this in the correct topic, routing is working.`,
    }),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (json.ok) {
    console.log(`  ✓ ${name.padEnd(28)} → thread ${threadId}`);
    return true;
  }
  console.error(`  ✗ ${name.padEnd(28)} → thread ${threadId}: ${json.description}`);
  return false;
}

async function main() {
  console.log("Posting test messages to all 9 topics...\n");
  let ok = 0;
  let fail = 0;
  for (const [name, id] of Object.entries(TOPICS)) {
    if (!id) {
      console.warn(`  - ${name}: no ID, skipping`);
      continue;
    }
    if (await send(name, id)) ok++; else fail++;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`\nResult: ${ok} ok, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
