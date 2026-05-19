/**
 * Auto-create the LockSafe Telegram forum topics and print the env-var block
 * to paste into Vercel.
 *
 * Requirements:
 *   - The Telegram bot must be an ADMIN of the supergroup with the
 *     "Manage Topics" permission enabled.
 *   - The group must be a SUPERGROUP with Topics turned on.
 *   - TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env.local.
 *
 * Run with:
 *   npx tsx scripts/setup-telegram-topics.ts
 *
 * Pass --reuse-existing to merge results with any pre-existing topic IDs in
 * your .env.local instead of overwriting them.
 */

import "dotenv/config";

interface CreateForumTopicResult {
  ok: boolean;
  result?: {
    message_thread_id: number;
    name: string;
    icon_color: number;
  };
  description?: string;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment.");
  process.exit(1);
}

// Topic spec — keep names short and the env-var keys aligned with src/lib/telegram.ts.
// Icon colours are valid Telegram preset values.
const TOPICS: Array<{ envVar: string; name: string; iconColor: number }> = [
  { envVar: "TELEGRAM_TOPIC_NEW_JOBS",     name: "New Jobs",            iconColor: 0x6FB9F0 },
  { envVar: "TELEGRAM_TOPIC_LOCKSMITHS",   name: "Locksmiths",          iconColor: 0xFFD67E },
  { envVar: "TELEGRAM_TOPIC_CUSTOMERS",    name: "Customers",           iconColor: 0xCB86DB },
  { envVar: "TELEGRAM_TOPIC_JOB_UPDATES",  name: "Job Updates",         iconColor: 0x8EEE98 },
  { envVar: "TELEGRAM_TOPIC_PAYMENTS",     name: "Payments",            iconColor: 0xFF93B2 },
  { envVar: "TELEGRAM_TOPIC_AGENTS",       name: "AI Agents",           iconColor: 0xFB6F5F },
  { envVar: "TELEGRAM_TOPIC_APPLICATIONS", name: "Job Applications",    iconColor: 0x6FB9F0 },
  { envVar: "TELEGRAM_TOPIC_QUOTES",       name: "Quotes",              iconColor: 0xFFD67E },
  { envVar: "TELEGRAM_TOPIC_REVIEWS",      name: "Reviews",             iconColor: 0x8EEE98 },
];

async function createTopic(name: string, iconColor: number): Promise<number | null> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/createForumTopic`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, name, icon_color: iconColor }),
  });
  const data = (await res.json()) as CreateForumTopicResult;
  if (!data.ok || !data.result) {
    console.error(`  ❌ ${name}: ${data.description || "unknown error"}`);
    return null;
  }
  return data.result.message_thread_id;
}

async function main() {
  console.log("🔧 Creating LockSafe Telegram forum topics...\n");

  const results: Array<{ envVar: string; name: string; id: number | null }> = [];

  for (const topic of TOPICS) {
    process.stdout.write(`  • ${topic.name.padEnd(20)} → `);
    const existing = process.env[topic.envVar];
    if (existing && /^\d+$/.test(existing)) {
      console.log(`already configured (id=${existing}), skipping`);
      results.push({ envVar: topic.envVar, name: topic.name, id: Number.parseInt(existing, 10) });
      continue;
    }
    const id = await createTopic(topic.name, topic.iconColor);
    if (id !== null) console.log(`✅ id=${id}`);
    results.push({ envVar: topic.envVar, name: topic.name, id });
    // Polite throttle so we don't hit Telegram's rate limit
    await new Promise((r) => setTimeout(r, 350));
  }

  console.log("\n──────────────────────────────────────────────────");
  console.log("📋 Paste this block into Vercel → Settings → Environment Variables");
  console.log("    (Production + Preview + Development) and redeploy:\n");
  for (const r of results) {
    if (r.id !== null) {
      console.log(`${r.envVar}=${r.id}`);
    } else {
      console.log(`# ${r.envVar}=  (failed — create the "${r.name}" topic manually and copy the thread id)`);
    }
  }
  console.log("──────────────────────────────────────────────────\n");

  const failures = results.filter((r) => r.id === null);
  if (failures.length > 0) {
    console.warn(`⚠️  ${failures.length} topic(s) failed. Most common cause: the bot is not an admin with "Manage Topics" permission, or the chat is not a supergroup with Topics enabled.`);
    process.exit(2);
  }

  console.log("✅ Done. After updating Vercel env vars and redeploying, all notifications will route to their correct topics.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
