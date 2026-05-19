/**
 * One-shot: scan supergroup for duplicate forum topics by name and delete the
 * stale ones, keeping the IDs we just wrote into env (300–308).
 *
 * Telegram does not expose getForumTopics, so we scan getUpdates for
 * forum_topic_created events. Run AFTER `setup-telegram-topics.ts` and
 * BEFORE any production traffic resumes.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!TOKEN || !CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env");
  process.exit(1);
}

// Topics we want to KEEP (just-created, now in Vercel env).
const KEEP: Record<string, number> = {
  "🆕 New Jobs": 300,
  "🔧 Locksmiths": 301,
  "👥 Customers": 302,
  "📋 Job Updates": 303,
  "💰 Payments": 304,
  "🤖 Agents": 305,
  "📝 Applications": 306,
  "💬 Quotes": 307,
  "⭐ Reviews": 308,
};

type Update = {
  update_id: number;
  message?: {
    chat: { id: number };
    message_thread_id?: number;
    forum_topic_created?: { name: string };
  };
};

async function api<T>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result as T;
}

async function main() {
  // Discover topics via getUpdates. Limit 100 max per Telegram; paginate via offset.
  console.log("Scanning getUpdates for forum_topic_created events...");
  const seen = new Map<string, Set<number>>(); // name -> set of thread IDs
  let offset = 0;
  for (let i = 0; i < 50; i++) {
    const updates = await api<Update[]>("getUpdates", {
      offset,
      limit: 100,
      timeout: 0,
      allowed_updates: ["message"],
    });
    if (updates.length === 0) break;
    for (const u of updates) {
      offset = u.update_id + 1;
      const m = u.message;
      if (!m?.forum_topic_created || !m.message_thread_id) continue;
      if (String(m.chat.id) !== CHAT_ID) continue;
      const name = m.forum_topic_created.name;
      if (!seen.has(name)) seen.set(name, new Set());
      seen.get(name)!.add(m.message_thread_id);
    }
    if (updates.length < 100) break;
  }

  console.log(`Found ${seen.size} distinct topic names in update window:`);
  for (const [name, ids] of seen) {
    console.log(`  ${name}: ${Array.from(ids).sort((a, b) => a - b).join(", ")}`);
  }

  // For each KEEP entry: delete every other ID with the same name.
  const toDelete: { name: string; id: number }[] = [];
  for (const [name, keepId] of Object.entries(KEEP)) {
    const ids = seen.get(name);
    if (!ids) {
      console.warn(`! No history found for "${name}" — assuming env id ${keepId} is fine.`);
      continue;
    }
    for (const id of ids) {
      if (id !== keepId) toDelete.push({ name, id });
    }
  }

  if (toDelete.length === 0) {
    console.log("No duplicates to delete. Done.");
    return;
  }

  console.log(`\nDeleting ${toDelete.length} duplicate topics:`);
  for (const { name, id } of toDelete) {
    try {
      await api("deleteForumTopic", {
        chat_id: CHAT_ID,
        message_thread_id: id,
      });
      console.log(`  ✓ deleted ${name} thread ${id}`);
    } catch (err) {
      console.error(`  ✗ failed ${name} thread ${id}: ${(err as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
