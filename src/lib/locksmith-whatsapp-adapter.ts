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
  getPendingApplications,
  getEarningsSummary,
  setAvailability,
  type LocksmithBotContext,
  type LocksmithCommand,
  type LocksmithBotMessage,
} from "@/lib/locksmith-bot";
import { getLocksmithCompleteness } from "@/lib/locksmith-completeness";
import { chat, Models, type LLMMessage, type OllamaTool } from "@/lib/llm-router";
import { upsertConversationByPhone, getWhatsAppConversationMessages } from "@/lib/whatsapp-inbox";
import { sendAdminAlert } from "@/lib/telegram";

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
    // help/start/menu → let the assistant give a warm, conversational welcome
    // grounded in their live data (no keyword menus). Falls back to the
    // templated help only if the AI is unreachable.
    if (command === "help" || command === "start") {
      try {
        const intro = await handleLocksmithAIChat(
          identity.id,
          identity.name,
          phone,
          command === "start"
            ? "(The locksmith just opened the chat.) Greet them warmly by first name, say in one line what you can help with, and — based on their live data — nudge the single most useful next step. Keep it short and human."
            : text,
        );
        if (intro) return intro;
      } catch (error) {
        console.error("[LocksmithWA] AI intro error:", error);
      }
    }
    const response = await handleLocksmithCommand(ctx, command, args);
    return botMessageToWhatsAppText(phone, response);
  }

  // Fallback: conversational AI (Ollama-first via llm-router, OpenAI emergency fallback)
  try {
    const reply = await handleLocksmithAIChat(identity.id, identity.name, phone, text);
    if (reply) return reply;
  } catch (error) {
    console.error("[LocksmithWA] AI chat error:", error);
  }

  // The AI brain is unreachable (e.g. Ollama host down + OpenAI cap hit). Stay
  // warm and human — no menus, just a clear path forward.
  return "Sorry, I'm having a brief technical hiccup on my end — give me another try in a moment. If it's urgent or you'd rather talk to a person, just reply *support* and the LockSafe team will jump straight in. 🙏";
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
    const requiredMissing = completeness.missing.filter((m) => m.blocking);
    const optionalMissing = completeness.missing.filter((m) => !m.blocking);
    lines.push(
      `Profile completeness: ${completeness.score}%` +
        (completeness.blockingDispatch
          ? " — BLOCKED from receiving jobs until the REQUIRED items below are done"
          : " — all REQUIRED items done; eligible to receive jobs"),
    );
    if (requiredMissing.length > 0) {
      lines.push(`REQUIRED before receiving jobs (still missing): ${requiredMissing.map((m) => m.label).join("; ")}`);
    }
    if (optionalMissing.length > 0) {
      lines.push(
        `OPTIONAL — boosts trust & dispatch ranking but NOT required to receive jobs: ${optionalMissing.map((m) => m.label).join("; ")}`,
      );
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

export async function getRecentChatHistory(phone: string, limit = 10): Promise<LLMMessage[]> {
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

// ── Tools the assistant can call (it both answers AND acts) ──────────────────
const LOCKSMITH_TOOLS: OllamaTool[] = [
  { type: "function", function: { name: "get_active_jobs", description: "The locksmith's current active jobs (accepted / en route / in progress).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_pending_jobs", description: "Jobs offered to the locksmith that they have NOT yet accepted.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_earnings", description: "Earnings summary: today, this week, this month, pending payout, lifetime, jobs completed.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_profile_status", description: "What's missing on the locksmith's profile and whether they're blocked from receiving jobs.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "set_availability", description: "Turn the locksmith Available (online, receives jobs) or Offline. Call when they clearly ask to go on or off.", parameters: { type: "object", properties: { available: { type: "boolean", description: "true = Available/online; false = Offline" } }, required: ["available"] } } },
  { type: "function", function: { name: "accept_job", description: "Accept a specific job offer. ONLY call after the locksmith has explicitly CONFIRMED accepting this exact job in their most recent message.", parameters: { type: "object", properties: { job_number: { type: "string", description: "e.g. NR2-JOB030" } }, required: ["job_number"] } } },
  { type: "function", function: { name: "decline_job", description: "Decline a specific job offer. ONLY call after the locksmith has explicitly CONFIRMED declining.", parameters: { type: "object", properties: { job_number: { type: "string" }, reason: { type: "string" } }, required: ["job_number"] } } },
  { type: "function", function: { name: "escalate_to_human", description: "Hand off to a human teammate. Use for refunds, disputes, complaints, account/payment problems you can't resolve, or when they ask for a person.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "app_help", description: "Get the right LockSafe app message for THIS locksmith — the install link if they don't have the app yet, or the update notice (latest version) if they already have it. Use when they ask about the app, mention install/update/download, can't get job alerts, or when you're nudging them to install it.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_team_status", description: "This locksmith's Team/company status: whether they OWN a team (with member count), are a MEMBER of someone's team (with their earnings split %), or are SOLO (no team). Use whenever they ask about Teams, adding staff/colleagues, or managing a company on LockSafe.", parameters: { type: "object", properties: {} } } },
];

const APP_LINKS =
  "📱 Android: https://play.google.com/store/apps/details?id=uk.locksafe.app\n🍎 iPhone: https://apps.apple.com/app/locksafe-locksmith-partner/id6762475008";
const LATEST_APP_VERSION = "1.0.4";

async function executeLocksmithTool(
  ctx: LocksmithBotContext,
  locksmithId: string,
  name: string,
  args: Record<string, unknown>,
  dryRun = false,
  triggeringText = "",
): Promise<string> {
  try {
    switch (name) {
      // Read-only tools — always safe to run, even in a trial.
      case "get_active_jobs":
        return JSON.stringify((await getActiveJobs(locksmithId)).jobs.slice(0, 8));
      case "get_pending_jobs":
        return JSON.stringify(await getPendingApplications(locksmithId));
      case "get_earnings":
        return JSON.stringify(await getEarningsSummary(locksmithId));
      case "get_profile_status": {
        const c = await getLocksmithCompleteness(locksmithId);
        return JSON.stringify({
          score: c?.score ?? null,
          canReceiveJobs: c ? !c.blockingDispatch : null,
          requiredMissing: c?.missing.filter((m) => m.blocking).map((m) => m.label) ?? [],
          optionalMissing: c?.missing.filter((m) => !m.blocking).map((m) => m.label) ?? [],
        });
      }
      // Mutating tools — in dryRun (trial mode) report intent instead of acting.
      case "set_availability": {
        if (dryRun) return `(dry run) would set this locksmith ${Boolean(args.available) ? "Available/online" : "Offline"}.`;
        const r = await setAvailability(locksmithId, Boolean(args.available));
        return r.message; // includes the base-location guard message if blocked
      }
      case "accept_job": {
        if (dryRun) return `(dry run) would ACCEPT job ${String(args.job_number ?? "")}.`;
        const r = await handleLocksmithCommand(ctx, "accept", [String(args.job_number ?? "")]);
        return r.text;
      }
      case "decline_job": {
        if (dryRun) return `(dry run) would DECLINE job ${String(args.job_number ?? "")}.`;
        const r = await handleLocksmithCommand(ctx, "decline", [String(args.job_number ?? ""), String(args.reason ?? "")]);
        return r.text;
      }
      case "app_help": {
        const l = await prisma.locksmith.findUnique({
          where: { id: locksmithId },
          select: { nativeDeviceToken: true, webPushSubscription: true },
        });
        const hasApp = Boolean(l?.nativeDeviceToken || l?.webPushSubscription);
        if (hasApp) {
          return (
            `HAS_APP. They already have the app installed. Let them know a new version (v${LATEST_APP_VERSION}) is out — ` +
            `improved location tracking, more reliable push notifications, and performance fixes — and ask them to open their app store and tap Update. Share the link for their phone:\n${APP_LINKS}`
          );
        }
        return (
          `NO_APP. They haven't installed the LockSafe app yet — it's how they get instant job alerts on their phone. ` +
          `Encourage them to install it now and share the link for their phone:\n${APP_LINKS}`
        );
      }
      case "get_team_status": {
        const owned = await prisma.locksmithCompany.findFirst({
          where: { ownerId: locksmithId, isActive: true },
          select: { name: true, _count: { select: { memberships: true } } },
        });
        if (owned) {
          return JSON.stringify({ role: "owner", teamName: owned.name, members: owned._count.memberships });
        }
        const m = await prisma.locksmithCompanyMember.findFirst({
          where: { locksmithId },
          select: {
            locksmithSplit: true,
            company: { select: { name: true, owner: { select: { name: true } } } },
          },
        });
        if (m) {
          return JSON.stringify({
            role: "member",
            teamName: m.company?.name ?? null,
            manager: m.company?.owner?.name ?? null,
            yourSplitPercent: m.locksmithSplit,
          });
        }
        return JSON.stringify({ role: "solo" });
      }
      case "escalate_to_human": {
        if (dryRun) return "(dry run) would flag this conversation to the LockSafe team for a human to pick up.";
        // Look up the real person so the human responder knows WHO + WHAT.
        const ls = await prisma.locksmith
          .findUnique({ where: { id: locksmithId }, select: { name: true, companyName: true, phone: true } })
          .catch(() => null);
        const who = ls
          ? `${ls.name}${ls.companyName ? ` (${ls.companyName})` : ""}`
          : `Locksmith ${locksmithId}`;
        const contact = ls?.phone || ctx.chatId;
        // Actually notify a human — otherwise the handoff goes nowhere.
        await sendAdminAlert({
          title: `🧑‍🔧 ${who} needs a human (WhatsApp)`,
          message:
            `${who} asked for human help on WhatsApp.\n` +
            `Contact: ${contact}\n` +
            (triggeringText ? `They said: "${triggeringText.slice(0, 300)}"\n` : "") +
            `Jump into the conversation to reply.`,
          severity: "warning",
          topic: "agents",
          dedupeKey: `locksmith-escalation:${locksmithId}`,
          cooldownMsOverride: 15 * 60 * 1000, // don't spam if they send a few messages
        }).catch(() => {});
        return "DONE: flagged for the LockSafe team — a human will reply right here in this chat.";
      }
      default:
        return "Unknown tool.";
    }
  } catch (e) {
    return `Tool error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * The conversational brain. LLM-first (qwen3:32b — warm + natural), with tools
 * so it can both ANSWER and ACT. Single-hop tool execution (the router has no
 * formal "tool" role, so we run the requested tools then feed the results back
 * as context for the final reply). Returns null only if the model is unreachable.
 */
export async function handleLocksmithAIChat(
  locksmithId: string,
  name: string,
  phone: string,
  text: string,
  opts: { dryRun?: boolean; historyOverride?: LLMMessage[]; traceSink?: string[] } = {},
): Promise<string | null> {
  const dryRun = opts.dryRun === true;
  const ctx: LocksmithBotContext = { locksmithId, chatId: phone, platform: "whatsapp" };
  const [contextBlock, history] = await Promise.all([
    buildLocksmithContextBlock(locksmithId),
    opts.historyOverride ? Promise.resolve(opts.historyOverride) : getRecentChatHistory(phone),
  ]);

  const system: LLMMessage = {
    role: "system",
    content: [
      `You are Lockie, the LockSafe UK assistant — a warm, sharp, genuinely helpful colleague chatting with ${name.split(" ")[0] || "a locksmith"} on WhatsApp. If you ever introduce yourself, you're "Lockie". LockSafe is a UK locksmith dispatch platform: customers book emergency/planned jobs, we dispatch vetted locksmiths, payment runs through the platform (Stripe), locksmiths set their own rates.`,
      `LIVE DATA about this locksmith right now (trust over anything else):\n${contextBlock}`,
      "You can DO things, not just talk: use the tools to check their jobs/earnings/profile, switch them Available/Offline, or accept/decline a job. Always prefer doing the thing over telling them how.",
      "APP: locksmiths get job alerts through the LockSafe phone app. If they ask about the app, mention install/update/download, say they're not getting alerts, or you're nudging them to install it — call app_help and pass on the link/message it returns (it gives the install link if they don't have the app, or the update notice if they do). Don't paste store links from memory; get them from app_help so they're correct for that locksmith.",
      "APP vs DASHBOARD — be clear about this: the phone app is mainly for the day-to-day — receiving job alerts, accepting/declining jobs, going Available/Offline. It does NOT have everything. The full menu — connecting Stripe payouts, uploading insurance and DBS, setting their call-out fee and base location, profile photo, Teams/company setup, and account settings — lives in the WEBSITE DASHBOARD (sign in at the LockSafe site). So whenever someone needs to set up, complete onboarding, change settings, or do anything beyond jobs and alerts, point them to the website dashboard, not the app. A good line: 'the app's for jobs and alerts — for setup and settings, hop into your dashboard on the website.' Encourage them to use the dashboard for all of that.",

      "TEAMS: a locksmith can run a team/company on LockSafe. A team OWNER (manager) invites their colleagues or employees — who must already be LockSafe locksmiths — by their email, and sets each member's earnings split (e.g. the member keeps 70%, the manager keeps the rest, after the platform fee). Members work under the owner's company. Any locksmith is either an OWNER, a MEMBER of someone's team, or SOLO (no team). They set all this up on the Team page of their LockSafe dashboard. When they ask about teams, adding staff, or managing a company, call get_team_status first to see where they stand, explain it plainly from that, and point them to the Team section of their dashboard to create a team or invite members (invites are by the colleague's email). Don't invent member limits, fees, or rules beyond this — if you're unsure, offer to have a teammate walk them through it.",
      "REQUIRED vs OPTIONAL — this matters, get it right: the items that BLOCK a locksmith from receiving jobs are — accept terms & conditions, set base location (postcode), set call-out fee, connect Stripe payouts, upload valid insurance, and upload a real profile photo. OPTIONAL (NOT required to receive jobs) are just the DBS check and installing the app — these boost trust and dispatch ranking only. NEVER tell a locksmith they must have a DBS or the app installed to get jobs — that's false; a locksmith without a DBS is perfectly fine since locksmithing isn't a regulated trade. Always trust canReceiveJobs and the REQUIRED vs OPTIONAL split in the data rather than guessing. If only optional items remain, tell them they're all set to receive jobs and mention DBS only as an optional edge (earns a Verified badge + better ranking).",
      "SAFETY: before calling accept_job or decline_job, the locksmith must have CLEARLY CONFIRMED that exact action in their latest message. If they're only asking about or considering a job, reply and ask them to confirm first (e.g. 'Want me to accept NR2-JOB030? Just say yes') — do NOT call the tool yet.",
      "Refunds, disputes, chargebacks, complaints, payment/account problems, or anything you genuinely can't resolve → you MUST call the escalate_to_human tool in that same turn. Never just say 'I'll escalate' or 'a human will be in touch' without actually calling escalate_to_human — saying it without calling it means nobody is notified.",
      "STYLE: sound like a real person, not a bot. Short (1-4 sentences), natural British English, warm and direct. Answer first, then act. Use *bold* sparingly. NEVER list keyword commands or menus — just have the conversation. Never invent data beyond what tools/LIVE DATA give you. Never promise specific job volumes or earnings.",
    ].join("\n\n"),
  };

  const baseMessages: LLMMessage[] = [system, ...history, { role: "user", content: text }];

  // First pass — let the model answer or request tools.
  const first = await chat(Models.QUALITY, baseMessages, {
    temperature: 0.5,
    maxTokens: 400,
    timeoutMs: 15_000,
    allowOpenAIFallback: true,
    thinkingMode: "no_think",
    tools: LOCKSMITH_TOOLS,
  });
  if (!first) return null;

  if (!first.toolCalls || first.toolCalls.length === 0) {
    return first.content?.trim() || null;
  }

  // Run the requested tools, then ask for a natural reply using the results.
  const results: string[] = [];
  for (const tc of first.toolCalls.slice(0, 4)) {
    const out = await executeLocksmithTool(ctx, locksmithId, tc.name, tc.arguments ?? {}, dryRun, text);
    results.push(`${tc.name} → ${out}`);
    opts.traceSink?.push(`${tc.name}(${JSON.stringify(tc.arguments ?? {})}) → ${out}`);
  }

  const followup = await chat(
    Models.QUALITY,
    [
      ...baseMessages,
      {
        role: "system",
        content:
          "You just used internal tools to handle the message above. Reply to the locksmith naturally using these results — do NOT mention tools, functions, or JSON. If a result reports a block or error, explain it warmly and tell them what to do.\n\n" +
          results.join("\n"),
      },
    ],
    { temperature: 0.5, maxTokens: 400, timeoutMs: 15_000, allowOpenAIFallback: true, thinkingMode: "no_think" },
  );

  return followup?.content?.trim() || results.join("\n") || null;
}

// ============================================
// LEAD RECRUITMENT FLOW
// ============================================

export async function handleLeadWhatsApp(
  identity: Extract<InboundIdentity, { kind: "lead" }>,
  text: string,
  phone?: string,
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

  // Mark replied (new/contacted → replied) so the team sees engagement.
  if (identity.status === "new" || identity.status === "contacted") {
    await prisma.locksmithLead.update({
      where: { id: identity.id },
      data: { status: "replied" },
    });
  }

  // Wants a real person / phone call → actually notify the team so the promise doesn't go nowhere.
  if (
    /\b(call me|give me a call|gimme a call|ring me|call back|callback|phone me|phone call|speak (to|with) (a|an|someone|somebody|a real|an actual)|talk (to|with) (a|an|someone|somebody)|real person|actual person|human being|someone (call|ring|phone))\b/.test(
      lower,
    )
  ) {
    const contact = phone || "their WhatsApp number";
    await sendAdminAlert({
      title: `📞 Locksmith lead wants a call — ${identity.name}`,
      message:
        `${identity.name} (${identity.city || "area unknown"}) asked to speak to a real person on WhatsApp.\n` +
        `Contact: ${contact}\n` +
        `Their message: "${text.trim()}"\n` +
        `Give them a call to answer questions and close the onboarding.`,
      severity: "warning",
      topic: "agents",
      dedupeKey: `lead-callback:${identity.id}`,
      cooldownMsOverride: 30 * 60 * 1000, // don't spam if they send a few messages
    }).catch(() => {});
    return (
      `Of course, ${firstName} — I've asked a LockSafe teammate to give you a call. 😊 ` +
      `If there's a time this afternoon or evening that suits you best, just let me know and I'll pass it on. ` +
      `Happy to answer anything here in the meantime — it's free to join, and commission is from 15% on the assessment fee and from 25% on completed work.`
    );
  }

  // Safe fallback if the model is unreachable.
  const fallback =
    `Brilliant, ${firstName}! LockSafe is free to join — no monthly or joining fees. You set your own rates and keep your call-out fee, ` +
    `and we send local emergency jobs straight to your phone (paid securely via Stripe). ` +
    `Commission is from 15% on the assessment fee and from 25% on completed work — deducted automatically, you keep the rest. ` +
    `Join here (~5 min): ${JOIN_URL} — any questions, just ask!`;

  // Agentic recruitment: Lockie actually converses to convert, with
  // cross-channel memory (same phone-keyed thread as SMS).
  const history = phone ? await getRecentChatHistory(phone).catch(() => []) : [];
  const system: LLMMessage = {
    role: "system",
    content: [
      `You are Lockie, the LockSafe UK assistant, chatting on WhatsApp with ${firstName}, a locksmith in ${identity.city} we'd love to have join the LockSafe network. Your goal: warmly answer their questions, ease any hesitation, and get them signed up — like a helpful colleague, not a salesperson.`,
      `HOW LOCKSAFE WORKS (all true — use what's relevant, don't dump it all at once): Free to join — no monthly fees, no joining fee, no hidden lead fees. You set your own rates and call-out fee. We send local emergency/planned jobs straight to your phone and you accept only the ones you want. Payment runs securely through the platform via Stripe. It's a vetted network, so customers trust it.`,
      `COMMISSION (these are the real figures — you CAN quote them directly when asked): the BASE commission is from 15% on the assessment fee (which covers travel & diagnosis) and from 25% on the work quote (charged on completed work). Commission is deducted automatically during payment — you keep the rest.`,
      `WHY IT SAYS "FROM" (commission can change per job — explain this honestly if they ask why it's not a flat rate): commission isn't a single fixed number. In busier areas where several locksmiths are available, an individual job can run through a quick market-rate auction, so the commission on THAT specific job may differ from base. The key reassurance: you ALWAYS see the exact commission for a job up front and choose to accept it yourself — nothing is ever taken at a rate you didn't agree to for that job, so there are genuinely no surprises. If they press for the maximum, be honest: commission goes up to a maximum of 40%, and only at times of very high peak demand on the most in-demand emergency jobs — it's a ceiling, not the norm, and again you only ever take a job once you've seen and confirmed its rate. Very active locksmiths and those in high-demand areas may also sit on a slightly different standing rate. Frame all of this positively and transparently — it's per-job and always confirmed, never a hidden hike. Do not quote any commission figures other than these (15%, 25%, up to ~40% on auctioned jobs), and never invent earnings or job volumes.`,
      `TO JOIN: share this link when they're interested — ${JOIN_URL} (about 5 minutes).`,
      "STYLE: a real, friendly person — not a brochure. Short (1-3 sentences), natural British English. Answer their actual question first (give the exact commission figures above if they ask — don't be vague or say you don't have them), then gently nudge toward joining. Never pushy or spammy. If they ask to speak to a person or want a phone call, reassure them a teammate will call them back — the team is notified automatically, so this is a real promise. NEVER quote commission figures other than the ones above, and never invent earnings or job volumes.",
    ].join("\n\n"),
  };

  const reply = await chat(
    Models.QUALITY,
    [system, ...history, { role: "user", content: text }],
    { temperature: 0.6, maxTokens: 300, timeoutMs: 15_000, allowOpenAIFallback: true, thinkingMode: "no_think" },
  );
  return reply?.content?.trim() || fallback;
}
