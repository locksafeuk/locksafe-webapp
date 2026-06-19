/**
 * WhatsApp Business Integration for LockSafe UK
 *
 * Phase 3: Customer Support Agent
 * - Customer verification flow
 * - Job status queries
 * - Real-time updates
 * - Escalation workflows
 *
 * Uses Meta WhatsApp Business API (Cloud API)
 *
 * Required Environment Variables:
 * - WHATSAPP_PHONE_NUMBER_ID: WhatsApp Business phone number ID
 * - WHATSAPP_ACCESS_TOKEN: Meta Graph API access token
 * - WHATSAPP_VERIFY_TOKEN: Webhook verification token
 * - WHATSAPP_BUSINESS_ACCOUNT_ID: WhatsApp Business Account ID
 */

import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SUPPORT_PHONE } from "@/lib/config";
import { processNaturalLanguageQuery } from "@/lib/openclaw-nlp";
import {
  startJobRequest,
  processJobRequestResponse,
  shouldStartJobRequest,
  isInJobRequestFlow,
} from "@/lib/whatsapp-job-request";
import {
  recordIncomingWhatsAppMessage,
  recordOutgoingWhatsAppMessage,
  updateWhatsAppMessageStatus,
} from "@/lib/whatsapp-inbox";

// Check if OpenAI is configured for NLP
const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;

// ============================================
// TYPES & INTERFACES
// ============================================

export interface WhatsAppMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text" | "interactive" | "template";
  text?: { body: string; preview_url?: boolean };
  interactive?: WhatsAppInteractive;
  template?: WhatsAppTemplate;
}

interface WhatsAppInteractive {
  type: "button" | "list";
  header?: { type: "text"; text: string };
  body: { text: string };
  footer?: { text: string };
  action: {
    buttons?: Array<{
      type: "reply";
      reply: { id: string; title: string };
    }>;
    button?: string;
    sections?: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  };
}

interface WhatsAppTemplate {
  name: string;
  language: { code: string };
  components?: Array<{
    type: "header" | "body" | "button";
    parameters?: Array<{ type: "text"; text: string }>;
  }>;
}

export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "interactive" | "button";
  text?: { body: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { text: string; payload: string };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: WhatsAppIncomingMessage[];
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface CustomerSession {
  customerId?: string;
  phone: string;
  verified: boolean;
  verificationCode?: string;
  verificationExpiry?: Date;
  currentJobId?: string;
  lastInteraction: Date;
  conversationState: ConversationState;
  context: Record<string, unknown>;
}

type ConversationState =
  | "greeting"
  | "verification_pending"
  | "verified"
  | "checking_job"
  | "viewing_job_details"
  | "requesting_callback"
  | "escalating"
  | "feedback";

// ============================================
// CONFIGURATION
// ============================================

const META_WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";
const TWILIO_API_URL = "https://api.twilio.com/2010-04-01";

// Human-readable previews of the WhatsApp templates we send, so the ADMIN INBOX
// logs the actual message (variables filled in) instead of a bare
// "[template:name]" label. Recipients always get the WhatsApp-rendered template;
// this is purely for our own conversation log. Bodies mirror the approved Twilio
// Content templates; {{n}} maps to parameters[n-1]. Unknown templates fall back
// to the name (plus any params) so nothing is silently lost.
const TEMPLATE_PREVIEWS: Record<string, string> = {
  profile_incomplete_v1:
    "Hi {{1}}, your LockSafe profile has {{2}} item(s) left to complete \u2014 next up: {{3}}. Finish your setup to start receiving jobs: https://www.locksafe.uk/locksmith/settings \u2014 reply here if you need a hand.",
  locksmith_recruit_invite:
    "Hi {{1}}, we're inviting trusted locksmiths in {{2}} to join LockSafe UK \u2014 free to join, you set your own rates, and emergency jobs in your area go straight to your phone. Interested? Reply YES and we'll get you set up. Reply STOP to opt out.",
};

function renderTemplatePreview(templateName: string, parameters: string[] = []): string {
  const body = TEMPLATE_PREVIEWS[templateName];
  if (!body) {
    return parameters.length > 0
      ? `[template:${templateName}] ${parameters.join(" | ")}`
      : `[template:${templateName}]`;
  }
  return body.replace(/\{\{(\d+)\}\}/g, (_m, n) => parameters[Number(n) - 1] ?? `{{${n}}}`);
}

type WhatsAppProvider = "meta" | "twilio";

interface WhatsAppProviderConfig {
  provider: WhatsAppProvider;
  apiBaseUrl: string;
  phoneNumberId?: string;
  accessToken?: string;
  verifyToken?: string;
  businessAccountId?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioWhatsAppNumber?: string;
}

function getConfig() {
  const rawProvider = (process.env.WHATSAPP_PROVIDER || "meta").trim().toLowerCase();
  const provider: WhatsAppProvider = rawProvider === "twilio" ? "twilio" : "meta";

  return {
    provider,
    apiBaseUrl:
      process.env.WHATSAPP_API_BASE_URL ||
      (provider === "twilio" ? TWILIO_API_URL : META_WHATSAPP_API_URL),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioWhatsAppNumber:
      process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER,
  } satisfies WhatsAppProviderConfig;
}

function isWhatsAppConfigured(config: WhatsAppProviderConfig): boolean {
  if (config.provider === "twilio") {
    return Boolean(
      config.twilioAccountSid && config.twilioAuthToken && config.twilioWhatsAppNumber,
    );
  }

  return Boolean(config.phoneNumberId && config.accessToken);
}

function getSendEndpoint(config: WhatsAppProviderConfig): string {
  return `${config.apiBaseUrl}/${config.phoneNumberId}/messages`;
}

function getSendHeaders(config: WhatsAppProviderConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.accessToken}`,
  };
}

function getMessageContentSummary(
  message: Partial<WhatsAppMessage> | Partial<WhatsAppIncomingMessage>,
): { messageType: string; content: string | null } {
  const messageType = message.type || "unknown";

  if (messageType === "text") {
    return {
      messageType,
      content: "text" in message ? message.text?.body || null : null,
    };
  }

  if (messageType === "template") {
    const templateName = "template" in message ? message.template?.name : undefined;
    return {
      messageType,
      content: `[template:${templateName ?? "unknown"}]`,
    };
  }

  if (messageType === "interactive") {
    const interactiveReply = (() => {
      if (!("interactive" in message) || !message.interactive) {
        return undefined;
      }

      const incomingInteractive = message.interactive as Partial<NonNullable<WhatsAppIncomingMessage["interactive"]>>;
      return incomingInteractive.button_reply?.title || incomingInteractive.list_reply?.title;
    })();

    return {
      messageType,
      content: interactiveReply || "[interactive message]",
    };
  }

  if (messageType === "button") {
    return {
      messageType,
      content: "button" in message ? message.button?.text || null : null,
    };
  }

  return { messageType, content: `[${messageType}]` };
}

/**
 * Flatten a structured WhatsApp message (interactive buttons/lists) into a
 * plain-text body for providers without native interactive support (Twilio
 * freeform messages). Options are rendered as numbered lines; the customer
 * replies with the number or the option text.
 */
function flattenMessageToText(
  message: Omit<WhatsAppMessage, "messaging_product" | "recipient_type" | "to">,
): string {
  if (message.type === "text" && message.text) {
    return message.text.body;
  }

  if (message.type === "interactive" && message.interactive) {
    const parts: string[] = [];
    if (message.interactive.header?.text) parts.push(`*${message.interactive.header.text}*`);
    parts.push(message.interactive.body.text);

    const options: string[] = [];
    for (const button of message.interactive.action.buttons || []) {
      options.push(button.reply.title);
    }
    for (const section of message.interactive.action.sections || []) {
      for (const row of section.rows) {
        options.push(row.description ? `${row.title} — ${row.description}` : row.title);
      }
    }
    if (options.length > 0) {
      parts.push(options.map((option, index) => `${index + 1}. ${option}`).join("\n"));
      parts.push("Reply with the option number or text.");
    }
    if (message.interactive.footer?.text) parts.push(`_${message.interactive.footer.text}_`);
    return parts.join("\n\n");
  }

  if (message.type === "template" && message.template) {
    const bodyComp = (message.template.components ?? []).find((c) => c.type === "body");
    const bodyParams = (bodyComp?.parameters ?? []).map((pp) => (pp as { text?: string }).text ?? "");
    return renderTemplatePreview(message.template.name, bodyParams);
  }

  return "";
}

/**
 * Send a WhatsApp message through the Twilio Messages API.
 */
async function sendViaTwilioWhatsApp(
  config: WhatsAppProviderConfig,
  to: string,
  body: string,
): Promise<{ ok: boolean; messageId?: string; error?: string; raw?: unknown }> {
  const from = (config.twilioWhatsAppNumber || "").trim();
  const normalizedFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  const normalizedTo = `whatsapp:+${normalizePhoneNumber(to)}`;

  const response = await fetch(
    `${TWILIO_API_URL}/Accounts/${config.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${config.twilioAccountSid}:${config.twilioAuthToken}`,
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        From: normalizedFrom,
        To: normalizedTo,
        Body: body,
      }),
    },
  );

  const data = (await response.json()) as { sid?: string; message?: string };
  if (response.ok) {
    return { ok: true, messageId: data.sid, raw: data };
  }
  return { ok: false, error: data.message || `Twilio error ${response.status}`, raw: data };
}

// In-memory session store (use Redis in production)
const sessions = new Map<string, CustomerSession>();

// ============================================
// WHATSAPP API FUNCTIONS
// ============================================

/**
 * Send a WhatsApp message
 */
export async function sendWhatsAppMessage(
  to: string,
  message: Omit<WhatsAppMessage, "messaging_product" | "recipient_type" | "to">
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getConfig();

  if (!isWhatsAppConfigured(config)) {
    console.warn("[WhatsApp] Not configured - message not sent");
    return { success: false, error: "WhatsApp not configured" };
  }

  // Twilio path: freeform text only — interactive messages are flattened
  // to numbered text options (Twilio interactive requires Content API templates).
  if (config.provider === "twilio") {
    const { messageType, content } = getMessageContentSummary({ ...message, type: message.type });
    const body = flattenMessageToText(message);

    if (!body) {
      return { success: false, error: "Unsupported message type for Twilio WhatsApp" };
    }

    // Remember the numbered options so a bare "1"/"2"/"3" reply can be
    // mapped back to the corresponding button id (no native buttons on
    // Twilio freeform messages).
    if (message.type === "interactive" && message.interactive) {
      const options: Array<{ id: string; title: string }> = [];
      for (const button of message.interactive.action.buttons || []) {
        options.push({ id: button.reply.id, title: button.reply.title });
      }
      for (const section of message.interactive.action.sections || []) {
        for (const row of section.rows) {
          options.push({ id: row.id, title: row.title });
        }
      }
      if (options.length > 0) {
        const session = getSession(to);
        updateSession(to, { context: { ...session.context, lastMenuOptions: options } });
      }
    }

    try {
      const result = await sendViaTwilioWhatsApp(config, to, body);

      await recordOutgoingWhatsAppMessage({
        phone: to,
        messageType,
        content,
        providerMessageId: result.messageId ?? null,
        rawPayload: { provider: "twilio", to, body, response: result.raw },
      });

      if (result.ok) {
        console.log(`[WhatsApp/Twilio] Message sent to ${to}`);
        return { success: true, messageId: result.messageId };
      }

      console.error("[WhatsApp/Twilio] API error:", result.error);
      return { success: false, error: result.error || "Failed to send" };
    } catch (error) {
      console.error("[WhatsApp/Twilio] Send error:", error);
      await recordOutgoingWhatsAppMessage({
        phone: to,
        messageType,
        content,
        providerMessageId: null,
        rawPayload: {
          provider: "twilio",
          to,
          body,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  try {
    const payload: WhatsAppMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhoneNumber(to),
      ...message,
    };

    const response = await fetch(getSendEndpoint(config), {
      method: "POST",
      headers: getSendHeaders(config),
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const { messageType, content } = getMessageContentSummary({ ...message, type: message.type });

    if (response.ok) {
      const sentMessageId = data.messages?.[0]?.id as string | undefined;

      await recordOutgoingWhatsAppMessage({
        phone: to,
        messageType,
        content,
        providerMessageId: sentMessageId ?? null,
        rawPayload: payload,
      });

      console.log(`[WhatsApp] Message sent to ${to}`);
      return { success: true, messageId: sentMessageId };
    }

    console.error("[WhatsApp] API error:", data);

    await recordOutgoingWhatsAppMessage({
      phone: to,
      messageType,
      content,
      providerMessageId: null,
      rawPayload: {
        request: payload,
        response: data,
      },
    });

    return { success: false, error: data.error?.message || "Failed to send" };
  } catch (error) {
    console.error("[WhatsApp] Send error:", error);
    const { messageType, content } = getMessageContentSummary({ ...message, type: message.type });

    await recordOutgoingWhatsAppMessage({
      phone: to,
      messageType,
      content,
      providerMessageId: null,
      rawPayload: {
        request: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizePhoneNumber(to),
          ...message,
        },
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send a text message
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendWhatsAppMessage(to, {
    type: "text",
    text: { body: text },
  });
}

/**
 * Send an interactive button message
 */
export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  options?: { header?: string; footer?: string }
): Promise<{ success: boolean; messageId?: string }> {
  return sendWhatsAppMessage(to, {
    type: "interactive",
    interactive: {
      type: "button",
      header: options?.header ? { type: "text", text: options.header } : undefined,
      body: { text: body },
      footer: options?.footer ? { text: options.footer } : undefined,
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: "reply" as const,
          reply: { id: btn.id, title: btn.title.slice(0, 20) },
        })),
      },
    },
  });
}

/**
 * Send a list message
 */
export async function sendListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  options?: { header?: string; footer?: string }
): Promise<{ success: boolean; messageId?: string }> {
  return sendWhatsAppMessage(to, {
    type: "interactive",
    interactive: {
      type: "list",
      header: options?.header ? { type: "text", text: options.header } : undefined,
      body: { text: body },
      footer: options?.footer ? { text: options.footer } : undefined,
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}

/**
 * Resolve a template name to a Twilio Content SID via env, e.g.
 * locksmith_recruit_invite → TWILIO_CONTENT_SID_LOCKSMITH_RECRUIT_INVITE
 */
function getTwilioContentSid(templateName: string): string | undefined {
  const envKey = `TWILIO_CONTENT_SID_${templateName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[envKey] || undefined;
}

/**
 * Send a template message (for outbound marketing/notifications).
 * Meta: native template payload. Twilio: Content API
 * (ContentSid + ContentVariables) — requires the template's Content SID
 * in env (TWILIO_CONTENT_SID_<TEMPLATE_NAME>).
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  parameters: string[] = [],
  options?: { languageCode?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getConfig();

  if (config.provider === "twilio") {
    const contentSid = getTwilioContentSid(templateName);
    if (!contentSid) {
      return {
        success: false,
        error: `No Twilio Content SID configured for template "${templateName}" (set TWILIO_CONTENT_SID_${templateName.toUpperCase().replace(/[^A-Z0-9]/g, "_")})`,
      };
    }

    if (!isWhatsAppConfigured(config)) {
      return { success: false, error: "WhatsApp not configured" };
    }

    const from = (config.twilioWhatsAppNumber || "").trim();
    const normalizedFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
    const normalizedTo = `whatsapp:+${normalizePhoneNumber(to)}`;
    const contentVariables = JSON.stringify(
      Object.fromEntries(parameters.map((value, index) => [`${index + 1}`, value])),
    );

    try {
      const response = await fetch(
        `${TWILIO_API_URL}/Accounts/${config.twilioAccountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${config.twilioAccountSid}:${config.twilioAuthToken}`,
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            From: normalizedFrom,
            To: normalizedTo,
            ContentSid: contentSid,
            ContentVariables: contentVariables,
          }),
        },
      );

      const data = (await response.json()) as { sid?: string; message?: string };

      await recordOutgoingWhatsAppMessage({
        phone: to,
        messageType: "template",
        content: renderTemplatePreview(templateName, parameters),
        providerMessageId: data.sid ?? null,
        rawPayload: { provider: "twilio", contentSid, contentVariables, response: data },
      });

      if (response.ok) {
        return { success: true, messageId: data.sid };
      }
      return { success: false, error: data.message || `Twilio error ${response.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  return sendWhatsAppMessage(to, {
    type: "template",
    template: {
      name: templateName,
      language: { code: options?.languageCode || "en_GB" },
      components: parameters.length > 0
        ? [
            {
              type: "body",
              parameters: parameters.map((p) => ({ type: "text", text: p })),
            },
          ]
        : undefined,
    },
  });
}

// ============================================
// PHONE NUMBER UTILITIES
// ============================================

function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");

  // Remove leading + for WhatsApp API
  if (normalized.startsWith("+")) {
    normalized = normalized.slice(1);
  }

  // Convert UK 07 to 447
  if (normalized.startsWith("07") && normalized.length === 11) {
    normalized = `44${normalized.slice(1)}`;
  }

  return normalized;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export function getSession(phone: string): CustomerSession {
  const normalized = normalizePhoneNumber(phone);
  let session = sessions.get(normalized);

  if (!session) {
    session = {
      phone: normalized,
      verified: false,
      lastInteraction: new Date(),
      conversationState: "greeting",
      context: {},
    };
    sessions.set(normalized, session);
  }

  session.lastInteraction = new Date();
  return session;
}

export function updateSession(phone: string, updates: Partial<CustomerSession>): CustomerSession {
  const session = getSession(phone);
  Object.assign(session, updates);
  sessions.set(normalizePhoneNumber(phone), session);
  return session;
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================
// CUSTOMER VERIFICATION
// ============================================

/**
 * Start customer verification process
 */
export async function startVerification(
  phone: string
): Promise<{ success: boolean; message: string }> {
  const session = getSession(phone);
  const code = generateVerificationCode();

  // Check if customer exists
  const customer = await prisma.customer.findFirst({
    where: {
      phone: {
        contains: phone.slice(-10), // Match last 10 digits
      },
    },
  });

  if (customer) {
    session.customerId = customer.id;
  }

  session.verificationCode = code;
  session.verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  session.conversationState = "verification_pending";
  updateSession(phone, session);

  // Send verification code via WhatsApp
  await sendTextMessage(
    phone,
    `🔒 Your LockSafe UK verification code is: *${code}*\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this message.`
  );

  return { success: true, message: "Verification code sent" };
}

/**
 * Verify customer code
 */
export async function verifyCode(
  phone: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  const session = getSession(phone);

  if (!session.verificationCode) {
    return { success: false, message: "No verification pending" };
  }

  if (session.verificationExpiry && session.verificationExpiry < new Date()) {
    return { success: false, message: "Verification code expired" };
  }

  if (session.verificationCode !== code) {
    return { success: false, message: "Invalid verification code" };
  }

  session.verified = true;
  session.verificationCode = undefined;
  session.verificationExpiry = undefined;
  session.conversationState = "verified";
  updateSession(phone, session);

  return { success: true, message: "Verification successful" };
}

// ============================================
// JOB QUERIES
// ============================================

/**
 * Get customer's recent jobs
 */
export async function getCustomerJobs(
  customerId: string,
  limit = 5
): Promise<
  Array<{
    id: string;
    jobNumber: string;
    status: string;
    postcode: string;
    locksmithName?: string;
    createdAt: Date;
  }>
> {
  const jobs = await prisma.job.findMany({
    where: { customerId },
    include: {
      locksmith: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jobs.map((job) => ({
    id: job.id,
    jobNumber: job.jobNumber,
    status: job.status,
    postcode: job.postcode,
    locksmithName: job.locksmith?.name,
    createdAt: job.createdAt,
  }));
}

/**
 * Get detailed job status for customer
 */
export async function getJobStatusForCustomer(
  jobId: string
): Promise<{
  found: boolean;
  job?: {
    jobNumber: string;
    status: string;
    statusText: string;
    locksmithName?: string;
    locksmithPhone?: string;
    eta?: string;
    quotedAmount?: number;
    address: string;
    createdAt: Date;
    timeline: Array<{ event: string; time: Date }>;
  };
}> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      locksmith: { select: { name: true, phone: true } },
      quote: { select: { total: true } },
    },
  });

  if (!job) {
    return { found: false };
  }

  // Build timeline
  const timeline: Array<{ event: string; time: Date }> = [];
  timeline.push({ event: "Job created", time: job.createdAt });
  if (job.acceptedAt) timeline.push({ event: "Locksmith assigned", time: job.acceptedAt });
  if (job.enRouteAt) timeline.push({ event: "Locksmith en route", time: job.enRouteAt });
  if (job.arrivedAt) timeline.push({ event: "Locksmith arrived", time: job.arrivedAt });
  if (job.diagnosedAt) timeline.push({ event: "Diagnosis complete", time: job.diagnosedAt });
  if (job.workStartedAt) timeline.push({ event: "Work started", time: job.workStartedAt });
  if (job.workCompletedAt) timeline.push({ event: "Work completed", time: job.workCompletedAt });
  if (job.signedAt) timeline.push({ event: "Job signed off", time: job.signedAt });

  const statusTextMap: Record<string, string> = {
    PENDING: "🔍 Looking for a locksmith in your area",
    ACCEPTED: "✅ A locksmith has been assigned to your job",
    EN_ROUTE: "🚗 Your locksmith is on the way",
    ARRIVED: "📍 Your locksmith has arrived",
    DIAGNOSING: "🔍 Assessing the situation",
    QUOTED: "💬 Quote sent - please review and approve",
    QUOTE_ACCEPTED: "👍 Quote accepted - work starting soon",
    IN_PROGRESS: "🔧 Work in progress",
    PENDING_CUSTOMER_CONFIRMATION: "✍️ Work complete - please confirm and sign",
    COMPLETED: "✔️ Job completed",
    SIGNED: "🎉 All done - thank you!",
    CANCELLED: "❌ Job cancelled",
  };

  return {
    found: true,
    job: {
      jobNumber: job.jobNumber,
      status: job.status,
      statusText: statusTextMap[job.status] || job.status,
      locksmithName: job.locksmith?.name,
      locksmithPhone: job.locksmith?.phone,
      eta: job.estimatedArrival || undefined,
      quotedAmount: job.quote?.total,
      address: job.address,
      createdAt: job.createdAt,
      timeline,
    },
  };
}

// ============================================
// ESCALATION WORKFLOWS
// ============================================

export type EscalationType =
  | "locksmith_late"
  | "quality_concern"
  | "payment_issue"
  | "safety_concern"
  | "general_complaint"
  | "urgent_callback";

interface EscalationRequest {
  customerId?: string;
  phone: string;
  type: EscalationType;
  jobId?: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
}

/**
 * Create escalation request
 */
export async function createEscalation(
  request: EscalationRequest
): Promise<{ success: boolean; ticketId: string }> {
  // In production, this would create a support ticket in your CRM/helpdesk
  const ticketId = `ESC-${Date.now().toString(36).toUpperCase()}`;

  console.log(`[WhatsApp] Escalation created: ${ticketId}`, request);

  // Send notification to admin
  const adminMessage = `
🚨 NEW ESCALATION: ${ticketId}

Type: ${request.type.replace(/_/g, " ").toUpperCase()}
Priority: ${request.priority.toUpperCase()}
Phone: ${request.phone}
${request.jobId ? `Job: ${request.jobId}` : ""}

${request.description}
  `.trim();

  // Send to admin via Telegram
  try {
    const { sendAdminAlert } = await import("@/lib/telegram");
    await sendAdminAlert({
      title: `🚨 WhatsApp Escalation: ${ticketId}`,
      message: adminMessage,
      severity: request.priority === "urgent" ? "error" : "warning",
    });
  } catch (err) {
    console.error("[WhatsApp] Failed to send admin alert:", err);
  }

  return { success: true, ticketId };
}

/**
 * Request callback from support team
 */
export async function requestCallback(
  phone: string,
  reason: string,
  preferredTime?: string
): Promise<{ success: boolean; message: string }> {
  const session = getSession(phone);

  await createEscalation({
    customerId: session.customerId,
    phone,
    type: "urgent_callback",
    jobId: session.currentJobId,
    description: `Callback requested: ${reason}. ${preferredTime ? `Preferred time: ${preferredTime}` : "ASAP"}`,
    priority: "high",
  });

  return {
    success: true,
    message: "Callback request submitted. Our team will call you within 15 minutes.",
  };
}

// ============================================
// MESSAGE HANDLER
// ============================================

/**
 * Process incoming WhatsApp message
 */
export async function handleIncomingMessage(
  message: WhatsAppIncomingMessage,
  senderName: string
): Promise<void> {
  const phone = message.from;
  const session = getSession(phone);

  // Extract message content
  let messageText = "";
  let buttonId = "";

  if (message.type === "text" && message.text) {
    messageText = message.text.body.trim();
  } else if (message.type === "interactive" && message.interactive) {
    if (message.interactive.button_reply) {
      buttonId = message.interactive.button_reply.id;
      messageText = message.interactive.button_reply.title;
    } else if (message.interactive.list_reply) {
      buttonId = message.interactive.list_reply.id;
      messageText = message.interactive.list_reply.title;
    }
  } else if (message.type === "button" && message.button) {
    buttonId = message.button.payload;
    messageText = message.button.text;
  }

  console.log(`[WhatsApp] Received from ${phone}: "${messageText}" (button: ${buttonId})`);

  await recordIncomingWhatsAppMessage({
    phone,
    waId: phone,
    contactName: senderName !== "Customer" ? senderName : null,
    messageType: message.type,
    content: messageText || null,
    providerMessageId: message.id,
    rawPayload: message,
  });

  // ── Identity routing ─────────────────────────────────────────────
  // Locksmiths get the Locksmith Assistant (same brain as the Telegram bot);
  // recruitment leads get the recruitment flow. Customers fall through.
  try {
    const { identifyInboundPhone, handleLocksmithWhatsApp, handleLeadWhatsApp } = await import(
      "@/lib/locksmith-whatsapp-adapter"
    );
    const identity = await identifyInboundPhone(phone);

    if (identity.kind === "locksmith") {
      const reply = await handleLocksmithWhatsApp(identity, phone, messageText);
      await sendTextMessage(phone, reply);
      return;
    }

    if (identity.kind === "lead") {
      const reply = await handleLeadWhatsApp(identity, messageText, phone);
      await sendTextMessage(phone, reply);
      return;
    }

    // Cost-saver: when a known customer messages in on WhatsApp, flip their
    // preferred channel to WhatsApp so future job updates route here instead of
    // SMS. Fire-and-forget — never block the reply. Behind CUSTOMER_WHATSAPP_UPDATES.
    if (process.env.CUSTOMER_WHATSAPP_UPDATES === "true") {
      try {
        const { getCustomerByPhone } = await import("@/lib/customer-service");
        const customer = await getCustomerByPhone(phone).catch(() => null);
        if (customer?.id) {
          const { default: prismaClient } = await import("@/lib/db");
          await prismaClient.customer
            .update({
              where: { id: customer.id },
              data: { preferredChannel: "whatsapp" },
            })
            .catch((err) => {
              console.error("[WhatsApp] preferredChannel switch failed:", err);
            });
        }
      } catch (err) {
        console.error("[WhatsApp] preferredChannel switch error:", err);
      }
    }

    // Customers → agentic customer Lockie (ChatGPT-style): he handles BOTH
    // booking a brand-new job and supporting an existing one, conversationally,
    // with full cross-channel memory. This replaces the old menu/booking flow.
    if (process.env.CUSTOMER_WHATSAPP_AGENTIC === "true") {
      const { handleCustomerLockie } = await import("@/lib/customer-lockie");
      const reply = await handleCustomerLockie(phone, messageText);
      if (reply) {
        await sendTextMessage(phone, reply);
        return;
      }
    }
  } catch (error) {
    console.error("[WhatsApp] Identity routing error (falling through to customer flow):", error);
  }
  // ─────────────────────────────────────────────────────────────────

  // Twilio flattened menus: map a bare option number ("1", "2", …) back to
  // the button id/title of the last menu we sent to this customer.
  if (!buttonId && /^\d{1,2}$/.test(messageText.trim())) {
    const options = getSession(phone).context.lastMenuOptions as
      | Array<{ id: string; title: string }>
      | undefined;
    const index = Number.parseInt(messageText.trim(), 10) - 1;
    if (options && index >= 0 && index < options.length) {
      buttonId = options[index].id;
      messageText = options[index].title;
    }
  }

  // Check if user is in job request flow
  if (isInJobRequestFlow(phone)) {
    const handled = await processJobRequestResponse(phone, messageText, buttonId);
    if (handled) return;
  }

  // Check if message should start job request flow
  if (buttonId === "start_request" || buttonId === "new_request" || shouldStartJobRequest(messageText)) {
    await startJobRequest(phone, senderName !== "Customer" ? senderName : undefined);
    return;
  }

  // Convert to lowercase for matching
  const lowerMessage = messageText.toLowerCase();

  // Handle based on conversation state
  switch (session.conversationState) {
    case "greeting":
      await handleGreeting(phone, senderName, lowerMessage);
      break;

    case "verification_pending":
      await handleVerification(phone, lowerMessage);
      break;

    case "verified":
    case "checking_job":
      await handleVerifiedMessage(phone, lowerMessage, buttonId);
      break;

    case "viewing_job_details":
      await handleJobDetailsAction(phone, lowerMessage, buttonId);
      break;

    case "requesting_callback":
      await handleCallbackRequest(phone, lowerMessage);
      break;

    case "escalating":
      await handleEscalationInput(phone, lowerMessage);
      break;

    case "feedback":
      await handleFeedback(phone, lowerMessage);
      break;

    default:
      await handleGreeting(phone, senderName, lowerMessage);
  }
}

// ============================================
// CONVERSATION HANDLERS
// ============================================

async function handleGreeting(phone: string, name: string, message: string): Promise<void> {
  // Check for keywords - job request takes priority
  if (shouldStartJobRequest(message)) {
    await startJobRequest(phone, name !== "Customer" ? name : undefined);
    return;
  }

  if (message.includes("job") || message.includes("status") || message.includes("track")) {
    await startVerification(phone);
    return;
  }

  if (
    message.includes("help") ||
    message.includes("support") ||
    message.includes("problem") ||
    message.includes("agent") ||
    message.includes("speak") ||
    message.includes("human")
  ) {
    await sendEscalationOptions(phone);
    return;
  }

  // Send welcome message
  await sendButtonMessage(
    phone,
    `Hello ${name}! 👋 Welcome to LockSafe UK.\n\n🔧 *24/7 Emergency Locksmith Service*\n\nHow can I help you today?`,
    [
      { id: "start_request", title: "🔧 Request Locksmith" },
      { id: "track_job", title: "📍 Track My Job" },
      { id: "speak_human", title: "💬 Speak to Agent" },
    ],
    { footer: "All locksmiths are vetted & insured" }
  );
}

async function handleVerification(phone: string, message: string): Promise<void> {
  // Check if message is a 6-digit code
  const codeMatch = message.match(/^\d{6}$/);

  if (codeMatch) {
    const result = await verifyCode(phone, codeMatch[0]);

    if (result.success) {
      await sendTextMessage(phone, "✅ Verification successful!\n\nLet me find your jobs...");
      await showCustomerJobs(phone);
    } else {
      await sendButtonMessage(
        phone,
        `❌ ${result.message}\n\nWould you like to try again?`,
        [
          { id: "resend_code", title: "📱 Resend Code" },
          { id: "speak_human", title: "💬 Speak to Agent" },
        ]
      );
    }
    return;
  }

  // Handle button responses
  if (message.includes("resend") || message === "resend_code") {
    await startVerification(phone);
    return;
  }

  await sendTextMessage(
    phone,
    "Please enter the 6-digit verification code sent to you.\n\nOr type 'resend' to get a new code."
  );
}

async function handleVerifiedMessage(phone: string, message: string, buttonId: string): Promise<void> {
  const session = getSession(phone);

  // Handle button actions
  if (buttonId === "track_job" || message.includes("track") || message.includes("status")) {
    await showCustomerJobs(phone);
    return;
  }

  if (buttonId === "new_request" || message.includes("new") || message.includes("request")) {
    await sendTextMessage(
      phone,
      `🔧 To submit a new locksmith request, please visit our website:\n\nhttps://locksafe.uk/request\n\nOr call us at ${SUPPORT_PHONE}`
    );
    return;
  }

  if (buttonId === "speak_human" || message.includes("agent") || message.includes("human") || message.includes("speak")) {
    await sendEscalationOptions(phone);
    return;
  }

  // Check if it's a job number (format: <PREFIX>-JOB<NNN>, e.g. SW1-JOB123)
  const jobNumberMatch = message.match(/[A-Z0-9]{1,4}-JOB\d{3,4}/i);
  if (jobNumberMatch) {
    await showJobDetails(phone, jobNumberMatch[0]);
    return;
  }

  // Check if selecting a job from list
  if (buttonId.startsWith("job_")) {
    const jobId = buttonId.replace("job_", "");
    await showJobDetails(phone, jobId);
    return;
  }

  // Try NLP for natural language understanding
  if (OPENAI_ENABLED && message.length > 3) {
    try {
      console.log(`[WhatsApp NLP] Processing: "${message}"`);

      const nlpResult = await processNaturalLanguageQuery(
        message,
        "customer",
        session.customerId,
        session.currentJobId
      );

      // Handle intents from NLP
      if (nlpResult.intent && nlpResult.intent !== "unknown") {
        await handleNlpIntent(phone, nlpResult.intent, nlpResult.entities || {}, nlpResult.response);
        return;
      }

      // If NLP gave a response but no specific intent, send the response
      if (nlpResult.response && nlpResult.response.length > 10) {
        await sendTextMessage(phone, nlpResult.response);
        return;
      }
    } catch (error) {
      console.error("[WhatsApp NLP] Error:", error);
    }
  }

  // Default response
  await sendButtonMessage(
    phone,
    "How can I help you?",
    [
      { id: "track_job", title: "📍 Track Job" },
      { id: "speak_human", title: "💬 Speak to Agent" },
    ]
  );
}

/**
 * Handle NLP-detected intents
 */
async function handleNlpIntent(
  phone: string,
  intent: string,
  entities: Record<string, unknown>,
  aiResponse?: string
): Promise<void> {
  const session = getSession(phone);

  switch (intent) {
    case "track_job":
    case "job_status":
      if (entities.jobNumber) {
        await showJobDetails(phone, entities.jobNumber as string);
      } else if (session.currentJobId) {
        await showJobDetails(phone, session.currentJobId);
      } else {
        await showCustomerJobs(phone);
      }
      break;

    case "get_eta":
      if (session.currentJobId) {
        const { job } = await getJobStatusForCustomer(session.currentJobId);
        if (job?.eta) {
          await sendTextMessage(phone, `⏱️ Your locksmith's ETA: ${job.eta}\n\n${job.locksmithName ? `👷 ${job.locksmithName}` : ""}`);
        } else if (job?.locksmithName) {
          await sendTextMessage(phone, `Your locksmith ${job.locksmithName} is on the way. We'll update you with an ETA shortly.`);
        } else {
          await sendTextMessage(phone, "We're still finding a locksmith for you. We'll notify you as soon as one is assigned.");
        }
      } else {
        await showCustomerJobs(phone);
      }
      break;

    case "contact_locksmith":
      if (session.currentJobId) {
        const { job } = await getJobStatusForCustomer(session.currentJobId);
        if (job?.locksmithPhone) {
          await sendTextMessage(phone, `📞 Your locksmith's phone number:\n\n${job.locksmithName}: ${job.locksmithPhone}`);
        } else {
          await sendTextMessage(phone, "No locksmith has been assigned yet. We'll notify you when one is on the way.");
        }
      } else {
        await sendTextMessage(phone, "Please tell me which job you're asking about, or select from your recent jobs.");
        await showCustomerJobs(phone);
      }
      break;

    case "cancel_job":
      await sendButtonMessage(
        phone,
        "⚠️ Are you sure you want to cancel your job?\n\nNote: Cancellation fees may apply depending on job status.",
        [
          { id: "confirm_cancel", title: "Yes, Cancel" },
          { id: "speak_human", title: "Speak to Agent" },
          { id: "back_to_jobs", title: "Back" },
        ]
      );
      break;

    case "report_issue":
    case "request_callback":
      await sendEscalationOptions(phone);
      break;

    case "greeting":
      await sendButtonMessage(
        phone,
        "Hello! 👋 Welcome back to LockSafe UK.\n\nHow can I help you today?",
        [
          { id: "track_job", title: "📍 Track My Job" },
          { id: "speak_human", title: "💬 Speak to Agent" },
        ]
      );
      break;

    case "help":
      await sendTextMessage(
        phone,
        "🔧 *LockSafe UK Help*\n\nHere's what I can help with:\n\n" +
        "📍 *Track your job* - See your locksmith's location and ETA\n" +
        "📞 *Contact locksmith* - Get their phone number\n" +
        "❓ *Report issue* - Escalate any problems\n" +
        "💬 *Speak to agent* - Request a callback\n\n" +
        "Just type what you need, or select an option below."
      );
      await sendButtonMessage(
        phone,
        "What would you like to do?",
        [
          { id: "track_job", title: "📍 Track Job" },
          { id: "speak_human", title: "💬 Speak to Agent" },
        ]
      );
      break;

    default:
      // Send AI response if available, otherwise default
      if (aiResponse) {
        await sendTextMessage(phone, aiResponse);
      } else {
        await sendButtonMessage(
          phone,
          "I'm not sure I understood. How can I help?",
          [
            { id: "track_job", title: "📍 Track Job" },
            { id: "speak_human", title: "💬 Speak to Agent" },
          ]
        );
      }
  }
}

async function handleJobDetailsAction(phone: string, message: string, buttonId: string): Promise<void> {
  const session = getSession(phone);

  if (buttonId === "contact_locksmith" || message.includes("call") || message.includes("contact")) {
    if (session.currentJobId) {
      const { job } = await getJobStatusForCustomer(session.currentJobId);
      if (job?.locksmithPhone) {
        await sendTextMessage(
          phone,
          `📞 Your locksmith's phone number:\n\n${job.locksmithName}: ${job.locksmithPhone}\n\nThey may be driving - please allow a few minutes for a response.`
        );
        return;
      }
    }
    await sendTextMessage(phone, "No locksmith has been assigned to this job yet.");
    return;
  }

  if (buttonId === "locksmith_late" || message.includes("late") || message.includes("where")) {
    updateSession(phone, { conversationState: "escalating", context: { escalationType: "locksmith_late" } });
    await sendTextMessage(
      phone,
      "I'm sorry your locksmith is running late. Let me escalate this for you.\n\nHow long have you been waiting past the estimated arrival time?"
    );
    return;
  }

  if (buttonId === "issue" || message.includes("problem") || message.includes("issue")) {
    await sendEscalationOptions(phone);
    return;
  }

  if (buttonId === "back_to_jobs") {
    await showCustomerJobs(phone);
    return;
  }

  await handleVerifiedMessage(phone, message, buttonId);
}

async function handleCallbackRequest(phone: string, message: string): Promise<void> {
  const result = await requestCallback(phone, message);
  await sendTextMessage(phone, result.message);
  updateSession(phone, { conversationState: "verified" });
}

async function handleEscalationInput(phone: string, message: string): Promise<void> {
  const session = getSession(phone);
  const escalationType = (session.context?.escalationType as EscalationType) || "general_complaint";

  const result = await createEscalation({
    customerId: session.customerId,
    phone,
    type: escalationType,
    jobId: session.currentJobId,
    description: message,
    priority: escalationType === "safety_concern" ? "urgent" : "high",
  });

  await sendTextMessage(
    phone,
    `✅ I've created a support ticket: ${result.ticketId}\n\nOur team will contact you within 15 minutes.\n\nIf this is an emergency, please call ${SUPPORT_PHONE}.`
  );

  updateSession(phone, { conversationState: "verified" });
}

async function handleFeedback(phone: string, message: string): Promise<void> {
  // Store feedback
  console.log(`[WhatsApp] Feedback from ${phone}: ${message}`);

  await sendTextMessage(
    phone,
    "Thank you for your feedback! 🙏\n\nWe really appreciate you taking the time to help us improve.\n\nIs there anything else I can help with?"
  );

  updateSession(phone, { conversationState: "verified" });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function showCustomerJobs(phone: string): Promise<void> {
  const session = getSession(phone);

  if (!session.customerId) {
    // Try to find customer by phone
    const customer = await prisma.customer.findFirst({
      where: {
        phone: { contains: phone.slice(-10) },
      },
    });

    if (!customer) {
      await sendTextMessage(
        phone,
        "I couldn't find any jobs associated with this phone number.\n\nIf you've recently made a request, please provide your job reference number (e.g., LS-2603-0001)."
      );
      return;
    }

    session.customerId = customer.id;
    updateSession(phone, session);
  }

  const jobs = await getCustomerJobs(session.customerId);

  if (jobs.length === 0) {
    await sendButtonMessage(
      phone,
      "You don't have any recent jobs.\n\nWould you like to make a new request?",
      [
        { id: "new_request", title: "🔧 New Request" },
        { id: "speak_human", title: "💬 Speak to Agent" },
      ]
    );
    return;
  }

  const sections = [
    {
      title: "Your Jobs",
      rows: jobs.map((job) => ({
        id: `job_${job.id}`,
        title: job.jobNumber,
        description: `${job.postcode} - ${formatJobStatus(job.status)}`,
      })),
    },
  ];

  await sendListMessage(
    phone,
    `Found ${jobs.length} job(s). Select one to view details:`,
    "View Jobs",
    sections,
    { header: "📋 Your Jobs" }
  );

  updateSession(phone, { conversationState: "checking_job" });
}

async function showJobDetails(phone: string, jobRef: string): Promise<void> {
  // Find job by ID or job number
  const job = await prisma.job.findFirst({
    where: {
      OR: [
        { id: jobRef },
        { jobNumber: { equals: jobRef.toUpperCase(), mode: "insensitive" } },
      ],
    },
  });

  if (!job) {
    await sendTextMessage(
      phone,
      `Job "${jobRef}" not found. Please check the job number and try again.`
    );
    return;
  }

  const { found, job: jobDetails } = await getJobStatusForCustomer(job.id);

  if (!found || !jobDetails) {
    await sendTextMessage(phone, "Unable to load job details. Please try again.");
    return;
  }

  updateSession(phone, { currentJobId: job.id, conversationState: "viewing_job_details" });

  let detailsText = `
📋 *Job: ${jobDetails.jobNumber}*

${jobDetails.statusText}

📍 ${jobDetails.address}
  `.trim();

  if (jobDetails.locksmithName) {
    detailsText += `\n\n👷 Locksmith: ${jobDetails.locksmithName}`;
    if (jobDetails.eta) {
      detailsText += `\n⏱️ ETA: ${jobDetails.eta}`;
    }
  }

  if (jobDetails.quotedAmount) {
    detailsText += `\n\n💰 Quoted: £${jobDetails.quotedAmount.toFixed(2)}`;
  }

  // Build buttons based on status
  const buttons: Array<{ id: string; title: string }> = [];

  if (jobDetails.locksmithName && jobDetails.locksmithPhone) {
    buttons.push({ id: "contact_locksmith", title: "📞 Call Locksmith" });
  }

  if (["EN_ROUTE", "ACCEPTED"].includes(job.status)) {
    buttons.push({ id: "locksmith_late", title: "⏰ Running Late?" });
  }

  buttons.push({ id: "issue", title: "❓ Report Issue" });

  await sendButtonMessage(phone, detailsText, buttons.slice(0, 3));
}

async function sendEscalationOptions(phone: string): Promise<void> {
  await sendListMessage(
    phone,
    "I'm sorry you're having an issue. Please select the type of help you need:",
    "Select Issue",
    [
      {
        title: "Issue Types",
        rows: [
          { id: "esc_late", title: "⏰ Locksmith is late", description: "Running past ETA" },
          { id: "esc_quality", title: "🔧 Quality concern", description: "Issue with work done" },
          { id: "esc_payment", title: "💳 Payment issue", description: "Billing or refund query" },
          { id: "esc_safety", title: "🚨 Safety concern", description: "Urgent safety matter" },
          { id: "esc_callback", title: "📞 Request callback", description: "Speak to an agent" },
        ],
      },
    ],
    { header: "How can we help?" }
  );

  updateSession(phone, { conversationState: "escalating" });
}

function formatJobStatus(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: "⏳ Pending",
    ACCEPTED: "✅ Accepted",
    EN_ROUTE: "🚗 En Route",
    ARRIVED: "📍 Arrived",
    IN_PROGRESS: "🔧 In Progress",
    COMPLETED: "✔️ Completed",
    SIGNED: "🎉 Done",
    CANCELLED: "❌ Cancelled",
  };
  return statusMap[status] || status;
}

// ============================================
// WEBHOOK VERIFICATION
// ============================================

/**
 * Verify WhatsApp webhook (for initial setup)
 */
export function verifyWebhook(params: {
  mode?: string;
  token?: string;
  challenge?: string;
}): { valid: boolean; challenge?: string } {
  const config = getConfig();

  if (
    params.mode === "subscribe" &&
    params.token === config.verifyToken
  ) {
    console.log("[WhatsApp] Webhook verified");
    return { valid: true, challenge: params.challenge };
  }

  console.warn("[WhatsApp] Webhook verification failed");
  return { valid: false };
}

/**
 * Verify the X-Hub-Signature-256 header on an incoming webhook POST.
 *
 * Meta signs the raw request body with the Meta App's app_secret using
 * HMAC-SHA256. Without this check, anyone can POST forged webhook
 * payloads to our endpoint.
 *
 * Returns:
 * - { configured: false } when META_APP_SECRET is not set (caller should
 *   warn but continue, so onboarding works before the secret is wired in)
 * - { configured: true, valid: boolean }
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): { configured: boolean; valid: boolean; warning?: string } {
  const config = getConfig();
  if (config.provider !== "meta") {
    return { configured: false, valid: false };
  }

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return {
      configured: false,
      valid: false,
      warning:
        "[WhatsApp Webhook] META_APP_SECRET not configured — accepting unsigned payload. Set the secret in Vercel to enable HMAC verification.",
    };
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return { configured: true, valid: false };
  }
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (expected.length !== received.length) {
    return { configured: true, valid: false };
  }
  try {
    const ok = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
    return { configured: true, valid: ok };
  } catch {
    return { configured: true, valid: false };
  }
}

type WhatsAppEchoMessage = Partial<WhatsAppIncomingMessage> & {
  to?: string;
  from?: string;
  id?: string;
  type?: string;
};

function getEchoMessages(value: WhatsAppWebhookPayload["entry"][number]["changes"][number]["value"]) {
  const valueRecord = value as Record<string, unknown>;
  const smbMessageEchoes = Array.isArray(valueRecord.smb_message_echoes)
    ? (valueRecord.smb_message_echoes as unknown[])
    : [];

  const rawMessages = [
    ...smbMessageEchoes,
    ...(Array.isArray((value as { messages?: unknown }).messages)
      ? ((value as { messages: unknown[] }).messages as unknown[])
      : []),
  ];

  return rawMessages.filter((message): message is WhatsAppEchoMessage => Boolean(message && typeof message === "object"));
}

async function handleCoexistenceEchoes(
  changeField: string,
  value: WhatsAppWebhookPayload["entry"][number]["changes"][number]["value"],
) {
  if (changeField !== "smb_message_echoes") {
    return;
  }

  for (const message of getEchoMessages(value)) {
    const phone = normalizePhoneNumber(message.to || message.from || "");
    if (!phone) continue;

    const { messageType, content } = getMessageContentSummary(message);
    await recordOutgoingWhatsAppMessage({
      phone,
      messageType,
      content,
      providerMessageId: message.id ?? null,
      rawPayload: {
        event: changeField,
        message,
      },
    });
  }
}

/**
 * Process incoming webhook payload
 */
export async function processWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account") {
    return;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;
      await handleCoexistenceEchoes(change.field, value);

      // Handle incoming messages
      if (change.field === "messages" && value.messages) {
        for (const message of value.messages) {
          const contact = value.contacts?.find((c) => c.wa_id === message.from);
          const senderName = contact?.profile?.name || "Customer";

          await handleIncomingMessage(message, senderName);
        }
      }

      // Handle status updates (message delivered, read, etc.)
      if (value.statuses) {
        for (const status of value.statuses) {
          console.log(`[WhatsApp] Message ${status.id} status: ${status.status}`);
          await updateWhatsAppMessageStatus({
            providerMessageId: status.id,
            status: status.status,
          });
        }
      }
    }
  }
}

// ============================================
// PROACTIVE NOTIFICATIONS
// ============================================

/**
 * Send job status update to customer
 */
export async function sendJobStatusUpdate(
  jobId: string,
  customMessage?: string
): Promise<{ success: boolean }> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      locksmith: { select: { name: true } },
    },
  });

  if (!job || !job.customer) {
    return { success: false };
  }

  const { job: jobDetails } = await getJobStatusForCustomer(jobId);

  if (!jobDetails) {
    return { success: false };
  }

  const message = customMessage || `
📍 Job Update: *${job.jobNumber}*

${jobDetails.statusText}

${job.locksmith ? `👷 ${job.locksmith.name}` : ""}
${jobDetails.eta ? `⏱️ ETA: ${jobDetails.eta}` : ""}
  `.trim();

  const result = await sendTextMessage(job.customer.phone, message);
  return { success: result.success };
}

/**
 * Send locksmith ETA update to customer
 */
export async function sendEtaUpdate(
  jobId: string,
  newEta: string
): Promise<{ success: boolean }> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      locksmith: { select: { name: true } },
    },
  });

  if (!job || !job.customer) {
    return { success: false };
  }

  const message = `
🚗 ETA Update for Job ${job.jobNumber}

Your locksmith ${job.locksmith?.name || ""} will arrive in approximately ${newEta}.

We'll notify you when they arrive.
  `.trim();

  const result = await sendTextMessage(job.customer.phone, message);
  return { success: result.success };
}
