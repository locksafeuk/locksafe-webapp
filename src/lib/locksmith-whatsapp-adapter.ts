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
  type LocksmithBotContext,
  type LocksmithCommand,
  type LocksmithBotMessage,
} from "@/lib/locksmith-bot";
import { getLocksmithCompleteness } from "@/lib/locksmith-completeness";

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

  // Fallback: NLP (same behaviour as the Telegram webhook)
  try {
    const { processNaturalLanguageQuery } = await import("@/lib/openclaw-nlp");
    const nlp = await processNaturalLanguageQuery(text, "locksmith", identity.id);
    if (nlp?.response) return htmlToWhatsApp(nlp.response);
  } catch {
    // NLP unavailable — fall through to help hint
  }

  return `I didn't catch that. Reply *help* for everything I can do — or *profile* to check your setup, *jobs* for your active jobs.`;
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
