import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.type === "admin";
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_ENABLED = process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true";

const TOPICS = {
  TOPIC_NEW_JOBS: process.env.TELEGRAM_TOPIC_NEW_JOBS,
  TOPIC_LOCKSMITHS: process.env.TELEGRAM_TOPIC_LOCKSMITHS,
  TOPIC_CUSTOMERS: process.env.TELEGRAM_TOPIC_CUSTOMERS,
  TOPIC_JOB_UPDATES: process.env.TELEGRAM_TOPIC_JOB_UPDATES,
  TOPIC_PAYMENTS: process.env.TELEGRAM_TOPIC_PAYMENTS,
  TOPIC_AGENTS: process.env.TELEGRAM_TOPIC_AGENTS,
  TOPIC_APPLICATIONS: process.env.TELEGRAM_TOPIC_APPLICATIONS,
  TOPIC_QUOTES: process.env.TELEGRAM_TOPIC_QUOTES,
  TOPIC_REVIEWS: process.env.TELEGRAM_TOPIC_REVIEWS,
} as const;

async function sendTest(text: string, threadId?: number): Promise<{ ok: boolean; description?: string }> {
  const body: Record<string, unknown> = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (threadId) body.message_thread_id = threadId;

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function GET(request: Request) {
  // Admin-only
  const isAdmin = await verifyAdminAuth(request as NextRequest);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check basic config
  const config = {
    enabled: TELEGRAM_ENABLED,
    hasToken: !!TELEGRAM_BOT_TOKEN,
    hasChatId: !!TELEGRAM_CHAT_ID,
    topics: Object.fromEntries(
      Object.entries(TOPICS).map(([k, v]) => [k, v ? `✅ Set (${v})` : "❌ Not set — will go to General"])
    ),
  };

  const { searchParams } = new URL(request.url);
  const sendTests = searchParams.get("send") === "true";

  if (!sendTests) {
    return NextResponse.json({
      message: "Telegram config status. Add ?send=true to fire test messages to every topic.",
      config,
    });
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return NextResponse.json({ error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" }, { status: 500 });
  }

  // Send a labeled test to each topic
  const results: Record<string, unknown> = {};

  for (const [topicKey, topicValue] of Object.entries(TOPICS)) {
    const threadId = topicValue ? parseInt(topicValue) : undefined;
    const label = topicKey.replace("TOPIC_", "").replace(/_/g, " ");
    const text = `🧪 <b>TEST — ${label}</b>\n\nThis message should appear in the <b>${label}</b> topic.\nEnv var: <code>${topicKey}</code> = <code>${topicValue ?? "NOT SET"}</code>`;

    const result = await sendTest(text, threadId);
    results[topicKey] = {
      threadId: threadId ?? "General (not set)",
      apiResponse: result,
    };
  }

  return NextResponse.json({
    message: "Test messages sent. Check each topic in Telegram.",
    config,
    results,
  });
}
