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
import { processNaturalLanguageQuery } from "@/lib/openclaw-nlp";
import {
  startJobRequest,
  processJobRequestResponse,
  shouldStartJobRequest,
  isInJobRequestFlow,
} from "@/lib/whatsapp-job-request";

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

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

function getConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  };
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

  if (!config.phoneNumberId || !config.accessToken) {
    console.warn("[WhatsApp] Not configured - message not sent");
    return { success: false, error: "WhatsApp not configured" };
  }

  try {
    const payload: WhatsAppMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhoneNumber(to),
      ...message,
    };

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log(`[WhatsApp] Message sent to ${to}`);
      return { success: true, messageId: data.messages?.[0]?.id };
    }

    console.error("[WhatsApp] API error:", data);
    return { success: false, error: data.error?.message || "Failed to send" };
  } catch (error) {
    console.error("[WhatsApp] Send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send a text message
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string }> {
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
 * Send a template message (for outbound marketing/notifications)
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  parameters: string[] = []
): Promise<{ success: boolean; messageId?: string }> {
  return sendWhatsAppMessage(to, {
    type: "template",
    template: {
      name: templateName,
      language: { code: "en_GB" },
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
    normalized = "44" + normalized.slice(1);
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

  // TODO: Send to admin Telegram/Slack/Email
  console.log("[WhatsApp] Admin notification:", adminMessage);

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

  if (message.includes("help") || message.includes("support") || message.includes("problem")) {
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
        "❌ " + result.message + "\n\nWould you like to try again?",
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
      "🔧 To submit a new locksmith request, please visit our website:\n\nhttps://locksafe.uk/request\n\nOr call us at 0800 XXX XXXX"
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
    `✅ I've created a support ticket: ${result.ticketId}\n\nOur team will contact you within 15 minutes.\n\nIf this is an emergency, please call 0800 XXX XXXX.`
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
  let job = await prisma.job.findFirst({
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
 * Process incoming webhook payload
 */
export async function processWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account") {
    return;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;

      // Handle incoming messages
      if (value.messages) {
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
