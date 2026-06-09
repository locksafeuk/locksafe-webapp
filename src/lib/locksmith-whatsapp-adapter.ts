/**
 * WhatsApp adapter for the Locksmith Personal Bot + Lead recruitment flow
 *
 * Thin transport layer: identity-routes inbound WhatsApp messages and reuses
 * the EXISTING locksmith-bot.ts command handlers (the same brain that powers
 * the Telegram bot). Nothing here re-implements business logic.
 *
 *   inbound phone → Locksmith      → Locksmith Assistant (this file)
 *                 → LocksmithLead  → recruitment flow (this file)
 *                 → anything else  → false (caller falls through to customer bot)
 *
 * First inbound message from a known locksmith auto-populates whatsappChatId
 * (the WhatsApp equivalent of the Telegram /start registration).
 */

import prisma from "@/lib/db";
import {
  handleLocksmithCommand,
  handleLocksmithCallback,
  registerLocksmithChat,
  getActiveJobs,
  getEarningsSummary,
  type LocksmithBotContext,
  type LocksmithCommand,
  type LocksmithBotMessage,
} from "@/lib/locksmith-bot";
import { getLocksmithCompleteness } from "@/lib/locksmith-completeness";
import { chat, Models, type LLMMessage } from "@/lib/llm-router";
import { upsertConversationByPhone, getWhatsAppConversationMessages } from "@/lib/whatsapp-inbox";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";
const JOIN_URL = process.env.LOCKSMITH_JOIN_URL || "https://locksafe.uk/join";

// ============================================
// PHONE MATCHING
// ============================================

/** Build the common UK representations of a normalized (digits-only, 44…) number. */
export function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/[^\d]/g, "");
  const intl = digits.startsWith("44")
    ? digits
    : digits.startsWith("0")
      ? `44${digits.slice(1)}`
      : digits;
  const bare = intl.slice(2); // e.g. 7377555299 (no prefix at all)
  const national = `0${bare}`;
  return [
    `+${intl}`,
    intl,
    national,
    bare,
    // spaced variants commonly stored from forms
    `+${intl.slice(0, 2)} ${bare}`,
    `${national.slice(0, 5)} ${national.slice(5)}`,
  ];
}

type InboundIdentity =
  | { kind: "locksmith"; id: string; name: string; whatsappChatId: string | null }
  | { kind: "lead"; id: string; name: string; city: string; status: string }
  | { kind: "unknown" };

/**
 * Regex that matches the number's significant digits regardless of how the
 * stored value is formatted ("020 8852 7495", "+44 20 8852 8850", "07…").
 * Real data audit (2026-06-07): 64% of lead phones contain spaces.
 */
function flexibleDigitsRegex(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const intl = digits.startsWith("44")
    ? digits
    : digits.startsWith("0")
      ? `44${digits.slice(1)}`
      : digits;
  const significant = intl.slice(2); // drop country code → e.g. 7377555299
  return `${significant.split("").join("[\\s\\-().]*")}[\\s\\-().]*$`;
}

export async function identifyInboundPhone(phone: string): Promise<InboundIdentity> {
  const variants = phoneVariants(phone);
  const regex = flexibleDigitsRegex(phone);

  // 1) Fast exact-variant match
  const locksmith = await prisma.locksmith.findFirst({
    where: { phone: { in: variants }, isActive: true },
    select: { id: true, name: true, whatsappChatId: true },
  });
  if (locksmith) return { kind: "locksmith", ...locksmith };

  // 2) Format-agnostic fallback (handles spaced/dashed stored numbers)
  const rawLocksmith = (await prisma.locksmith.findRaw({
    filter: { phone: { $regex: regex }, isActive: true },
    options: { limit: 1, projection: { name: 1, whatsappChatId: 1 } },
  })) as unknown as Array<{ _id: { $oid: string }; name: string; whatsappChatId?: string | null }>;
  if (rawLocksmith?.length > 0) {
    const doc = rawLocksmith[0];
    return {
      kind: "locksmith",
      id: doc._id.$oid,
      name: doc.name,
      whatsappChatId: doc.whatsappChatId ?? null,
    };
  }

  const lead = await prisma.locksmithLead.findFirst({
    where: { phone: { in: variants }, status: { not: "onboarded" } },
    select: { id: true, name: true, city: true, status: true },
  });
  if (lead) return { kind: "lead", ...lead };

  const rawLead = (await prisma.locksmithLead.findRaw({
    filter: { phone: { $regex: regex }, status: { $ne: "onboarded" } },
    options: { limit: 1, projection: { name: 1, city: 1, status: 1 } },
  })) as unknown as Array<{ _id: { $oid: string }; name: string; city: string; status: string }>;
  if (rawLead?.length > 0) {
    const doc = rawLead[0];
    return { kind: "lead", id: doc._id.$oid, name: doc.name, city: doc.city, status: doc.status };
  }

  return { kind: "unknown" };
}

// ============================================
// MESSAGE CONVERSION (Telegram HTML → WhatsApp)
// ============================================

/** Numbered callback options offered to a phone, so a bare "1"/"2" reply maps back. */
const pendingCallbacks = new Map<string, string[]>();

function htmlToWhatsApp(text: string): string {
  return text
    .replace(/<b>([\s\S]*?)<\/b>/gi, "*$1*")
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, "*$1*")
    .replace(/<i>([\s\S]*?)<\/i>/gi, "_$1_")
    .replace(/<em>([\s\S]*?)<\/em>/gi, "_$1_")
    .replace(/<code>([\s\S]*?)<\/code>/gi, "```$1```")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function botMessageToWhatsAppText(phone: string, message: LocksmithBotMessage): string {
  const parts: string[] = [htmlToWhatsApp(message.text)];

  const urlButtons = (message.buttons || []).filter((b) => b.url);
  const callbackButtons = (message.buttons || []).filter((b) => b.callbackData);

  if (urlButtons.length > 0) {
    parts.push(urlButtons.map((b) => `🔗 ${b.text}: ${b.url}`).join("\n"));
  }

  if (callbackButtons.length > 0) {
    pendingCallbacks.set(
      phone,
      callbackButtons.map((b) => b.callbackData as string),
    );
    parts.push(
      callbackButtons.map((b, i) => `${i + 1}. ${b.text}`).join("\n") +
        "\n\nReply with the option number.",
    );
  } else {
    pendingCallbacks.delete(phone);
  }

  return parts.join("\n\n");
}

// ============================================
// COMMAND PARSING
// ============================================

const COMMAND_ALIASES: Record<string, LocksmithCommand> = {
  start: "start",
  help: "help",
  menu: "help",
  hi: "help",
  hello: "help",
  status: "status",
  available: "available",
  online: "available",
  on: "available",
  offline: "offline",
  off: "offline",
  toggle: "toggle",
  jobs: "jobs",
  job: "jobs",
  pending: "pending",
  earnings: "earnings",
  money: "earnings",
  stats: "stats",
  accept: "accept",
  decline: "decline",
  quote: "quote_help",
  quote_help: "quote_help",
};

function parseLocksmithText(text: string): { command: LocksmithCommand | "profile" | "install" | null; args: string[] } {
  const cleaned = text.trim().replace(/^\//, "");
  const parts = cleaned.split(/\s+/);
  const head = (parts[0] || "").toLowerCase();
  const args = parts.slice(1);

  if (["profile", "setup", "complete", "checklist"].includes(head)) return { command: "profile", args };
  if (["install", "app"].includes(head)) return { command: "install", args };

  // Natural phrasing — "why am I not getting jobs?", "no jobs coming", "where's
  // my work" → the setup/profile card, which tells them exactly what's blocking
  // dispatch. This is the most common activation question.
  const lower = cleaned.toLowerCase();
  if (/why.*(job|work)|not getting (any )?(job|work)|no (jobs|work)\b|where.*(my )?(job|work)|getting no (job|work)/.test(lower)) {
    return { command: "profile", args };
  }

  const mapped = COMMAND_ALIASES[head];
  return { command: mapped ?? null, args };
}

// ============================================
// NEW SHARED FLOWS (profile / install)
// ============================================

async function buildProfileCard(locksmithId: string, name: string): Promise<string> {
  const completeness = await getLocksmithCompleteness(locksmithId);
  if (!completeness) return "Couldn't load your profile right now — please try again later.";

  const lines = completeness.items.map((i) => `${i.done ? "✅" : "❌"} ${i.label}`);
  const missingLinks = completeness.missing
    .slice(0, 3)
    .map((i) => `🔗 ${i.label}: ${i.deepLink}`);

  let footer: string;
  if (completeness.missing.length === 0) {
    footer = "🎉 Your profile is 100% complete — you're fully set up for jobs!";
  } else if (completeness.blockingDispatch) {
    footer = "⚠️ Items marked ❌ above include steps required before you can receive jobs.";
  } else {
    footer = "You can receive jobs — finish the remaining items to build customer trust.";
  }

  return [
    `*Profile status for ${name}* — ${completeness.score}% complete`,
    lines.join("\n"),
    missingLinks.length > 0 ? missingLinks.join("\n") : "",
    footer,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildInstallWalkthrough(): string {
  return [
    "*📲 Install the LockSafe app*",
    `1. Open ${SITE_URL}/install on your phone`,
    "2. iPhone: tap Share → *Add to Home Screen* · Android: tap *Install app* when prompted",
    "3. Log in with your locksmith account",
    "4. Allow notifications — that's how new jobs reach you instantly",
    "Stuck on any step? Just reply here and our team will help you out.",
  ].join("\n\n");
}

// ============================================
// LOCKSMITH ASSISTANT ENTRY
// ============================================

export async function handleLocksmithWhatsApp(
  identity: Extract<InboundIdentity, { kind: "locksmith" }>,
  phone: string,
  text: string,
): Promise<string> {
  // Auto-link: first inbound WhatsApp registers the chat (Telegram's /start equivalent)
  if (!identity.whatsappChatId) {
    await registerLocksmithChat(identity.id, phone, "whatsapp");
  }

  const ctx: LocksmithBotContext = { locksmithId: identity.id, chatId: phone, platform: "whatsapp" };

  // Activation opt-out — STOP the autonomous activation agent from nudging
  // this locksmith again (they can still use the assistant normally).
  if (/^\s*(stop|unsubscribe|opt ?out|no thanks|leave me alone)\b/i.test(text)) {
    await (prisma as unknown as {
      locksmith: { update: (a: unknown) => Promise<unknown> };
    })
      .locksmith.update({ where: { id: identity.id }, data: { activationOptedOut: true } })
      .catch(() => {});
    return "No problem — I won't send you any more setup reminders. You can still message me anytime (try *profile*, *jobs*, or *available*), and the team is one *support* away. 👍";
  }

  // Bare number → pending callback option (accept/decline buttons etc.)
  const trimmed = text.trim();
  if (/^\d{1,2}$/.test(trimmed)) {
    const options = pendingCallbacks.get(phone);
    const index = Number.parseInt(trimmed, 10) - 1;
    if (options && index >= 0 && index < options.length) {
      pendingCallbacks.delete(phone);
      const response = await handleLocksmithCallback(ctx, options[index]);
      return botMessageToWhatsAppText(phone, response);
    }
  }

  // Human escalation — message is already in the admin WhatsApp inbox
  if (/^(support|agent|human)\b/i.test(text.trim())) {
    return "👍 Got it — I've flagged this for the LockSafe team. A real person will reply to you right here, usually within working hours. Feel free to add any details in the meantime.";
  }

  const { command, args } = parseLocksmithText(text);

  if (command === "profile") {
    return buildProfileCard(identity.id, identity.name);
  }
  if (command === "install") {
    return buildInstallWalkthrough();
  }
  if (command) {
    const response = await handleLocksmithCommand(ctx, command, args);
    const converted = botMessageToWhatsAppText(phone, response);
    // Extend the help menu with the WhatsApp-only commands
    if (command === "help" || command === "start") {
      return `${converted}\n\n*🧰 Profile*\nprofile - Check what's missing on your profile\ninstall - App install walkthrough\n\nTip: no need for "/" — just type the word.`;
    }
    return converted;
  }

  // Fallback: conversational AI (Ollama-first via llm-router, OpenAI emergency fallback)
  try {
    const reply = await handleLocksmithAIChat(identity.id, identity.name, phone, text);
    if (reply) return reply;
  } catch (error) {
    console.error("[LocksmithWA] AI chat error:", error);
  }

  return `I didn't catch that. Reply *help* for everything I can do — or *profile* to check your setup, *jobs* for your active jobs.`;
}

// ============================================
// CONVERSATIONAL AI (free-text chat experience)
// ============================================

async function buildLocksmithContextBlock(locksmithId: string): Promise<string> {
  const [locksmith, completeness, activeJobs, earnings] = await Promise.all([
    prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: { name: true, isAvailable: true, defaultAssessmentFee: true, coverageRadius: true, baseAddress: true },
    }),
    getLocksmithCompleteness(locksmithId).catch(() => null),
    getActiveJobs(locksmithId).catch(() => ({ jobs: [] })),
    getEarningsSummary(locksmithId).catch(() => null),
  ]);

  const lines: string[] = [];
  if (locksmith) {
    lines.push(`Name: ${locksmith.name}`);
    lines.push(`Currently: ${locksmith.isAvailable ? "AVAILABLE for jobs" : "OFFLINE (not receiving jobs)"}`);
    if (locksmith.defaultAssessmentFee != null) lines.push(`Call-out fee: £${locksmith.defaultAssessmentFee}`);
    if (locksmith.baseAddress) lines.push(`Base: ${locksmith.baseAddress} (radius ${locksmith.coverageRadius} miles)`);
  }
  if (completeness) {
    lines.push(`Profile completeness: ${completeness.score}%${completeness.blockingDispatch ? " — BLOCKED from receiving jobs until required items are done" : ""}`);
    if (completeness.missing.length > 0) {
      lines.push(`Missing items: ${completeness.missing.map((m) => m.label).join("; ")}`);
    }
  }
  if (activeJobs.jobs.length > 0) {
    lines.push(
      `Active jobs (${activeJobs.jobs.length}): ` +
        activeJobs.jobs
          .slice(0, 5)
          .map((j) => `${j.jobNumber} [${j.status}] ${j.problemType} @ ${j.postcode}`)
          .join(" | "),
    );
  } else {
    lines.push("Active jobs: none right now");
  }
  if (earnings) {
    lines.push(
      `Earnings: today £${earnings.today.toFixed(2)}, this week £${earnings.thisWeek.toFixed(2)}, this month £${earnings.thisMonth.toFixed(2)}, pending payout £${earnings.pendingPayout.toFixed(2)}, lifetime £${earnings.totalEarnings.toFixed(2)} (${earnings.jobsCompleted} jobs completed)`,
    );
  }
  return lines.join("\n");
}

async function getRecentChatHistory(phone: string, limit = 10): Promise<LLMMessage[]> {
  try {
    const conversation = await upsertConversationByPhone({ phone });
    const messages = await getWhatsAppConversationMessages(conversation.id);
    return messages
      .filter((m) => m.content && m.content.trim().length > 0)
      .slice(-limit)
      .map((m) => ({
        role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: (m.content as string).slice(0, 600),
      }));
  } catch {
    return [];
  }
}

export async function handleLocksmithAIChat(
  locksmithId: string,
  name: string,
  phone: string,
  text: string,
): Promise<string | null> {
  const [contextBlock, history] = await Promise.all([
    buildLocksmithContextBlock(locksmithId),
    getRecentChatHistory(phone),
  ]);

  const system: LLMMessage = {
    role: "system",
    content: [
      "You are the LockSafe UK assistant chatting with one of our locksmiths on WhatsApp. LockSafe is a UK locksmith dispatch platform: customers book emergency/planned jobs, we dispatch vetted locksmiths, payment flows through the platform (Stripe), and locksmiths set their own rates.",
      `LIVE DATA for this locksmith (trust this over anything else):\n${contextBlock}`,
      "You can tell them about quick keyword commands: 'jobs', 'pending', 'earnings', 'stats', 'profile' (setup checklist), 'install' (app install), 'available'/'offline' (availability), 'accept <job no>', 'decline <job no>'.",
      `Key links: settings https://www.locksafe.uk/locksmith/settings · dashboard https://www.locksafe.uk/locksmith/dashboard · app install https://www.locksafe.uk/install`,
      "Style: WhatsApp message — short (2-6 sentences), friendly, professional. Use *bold* sparingly, no markdown headers, no bullet walls. Answer the question directly first.",
      "Rules: never invent job, payment or customer data beyond LIVE DATA. Money/dispute/refund issues or anything you can't resolve → tell them to reply 'support' so the team picks it up (a human reads this inbox). Never promise specific job volumes or earnings. UK context only.",
    ].join("\n\n"),
  };

  const response = await chat(
    Models.HERMES,
    [system, ...history, { role: "user", content: text }],
    {
      temperature: 0.4,
      maxTokens: 350,
      timeoutMs: 10_000,
      allowOpenAIFallback: true,
    },
  );

  const reply = response?.content?.trim();
  if (!reply) return null;
  console.log(`[LocksmithWA] AI chat reply for ${name} via ${response.model}`);
  return reply;
}

// ============================================
// LEAD RECRUITMENT FLOW
// ============================================

export async function handleLeadWhatsApp(
  identity: Extract<InboundIdentity, { kind: "lead" }>,
  text: string,
): Promise<string> {
  const lower = text.trim().toLowerCase();
  const firstName = identity.name.split(" ")[0] || identity.name;

  // Opt-out
  if (/\b(stop|unsubscribe|opt ?out|remove me)\b/.test(lower)) {
    await prisma.locksmithLead.update({
      where: { id: identity.id },
      data: { status: "not_interested", notes: "Opted out via WhatsApp" },
    });
    return "No problem — you won't hear from us again. All the best! 👍";
  }

  // Mark replied (new/contacted → replied) so the team sees engagement in the dashboard
  if (identity.status === "new" || identity.status === "contacted") {
    await prisma.locksmithLead.update({
      where: { id: identity.id },
      data: { status: "replied" },
    });
  }

  // Positive intent → join link
  if (/\b(yes|yeah|yep|join|interested|sign ?(me )?up|how|tell me more|info)\b/.test(lower)) {
    return [
      `Brilliant, ${firstName}! 🔧 Here's how LockSafe works:`,
      "• Free to join — no monthly fees\n• You set your own rates & call-out fee\n• Emergency jobs in your area sent straight to your phone\n• Paid out directly via Stripe",
      `Join here (takes ~5 minutes): ${JOIN_URL}`,
      "Any questions, just reply — a real person from our team reads these.",
    ].join("\n\n");
  }

  // Anything else → acknowledge + handoff to admin inbox (message is already recorded there)
  return [
    `Hi ${firstName}, thanks for getting back to us! We connect vetted locksmiths in ${identity.city} with local emergency jobs — free to join, you keep your rates.`,
    `Have a look: ${JOIN_URL}`,
    "Questions? Just reply here — our team will get back to you shortly.",
  ].join("\n\n");
}
