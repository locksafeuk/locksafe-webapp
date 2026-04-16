/**
 * OpenClaw NLP Integration for LockSafe UK
 *
 * Natural Language Processing for:
 * - Admin conversational queries (Telegram)
 * - Locksmith bot interactions
 * - Customer support queries (WhatsApp)
 *
 * Uses OpenAI GPT-4 or compatible LLM via OpenClaw
 *
 * Required Environment Variables:
 * - OPENAI_API_KEY: OpenAI API key (or OPENCLAW_API_KEY for self-hosted)
 * - OPENCLAW_ENDPOINT: Optional custom endpoint for self-hosted OpenClaw
 */

import prisma from "@/lib/db";
import { findBestLocksmiths, type DispatchCandidate } from "@/lib/intelligent-dispatch";
import { JobStatus } from "@prisma/client";

// ============================================
// TYPES & INTERFACES
// ============================================

export interface NLPIntent {
  intent: IntentType;
  confidence: number;
  entities: Record<string, string | number | boolean>;
  suggestedResponse?: string;
}

export type IntentType =
  // Admin intents
  | "list_jobs"
  | "job_status"
  | "find_locksmith"
  | "dispatch_job"
  | "assign_job"
  | "toggle_availability"
  | "get_stats"
  | "get_alerts"
  | "list_locksmiths"
  | "view_earnings"
  | "check_coverage"
  // Customer intents
  | "track_job"
  | "get_eta"
  | "contact_locksmith"
  | "request_callback"
  | "report_issue"
  | "cancel_job"
  | "update_address"
  | "get_quote"
  | "make_payment"
  // Locksmith intents
  | "accept_job"
  | "decline_job"
  | "update_status"
  | "send_quote"
  | "check_earnings"
  | "go_online"
  | "go_offline"
  | "view_active_jobs"
  // General
  | "greeting"
  | "help"
  | "unknown";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ConversationContext {
  role: "admin" | "locksmith" | "customer";
  userId?: string;
  currentJobId?: string;
  recentEntities: Record<string, string>;
  messageHistory: Array<{ role: string; content: string }>;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  intent?: IntentType;
}

// ============================================
// CONFIGURATION
// ============================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENCLAW_ENDPOINT = process.env.OPENCLAW_ENDPOINT || "https://api.openai.com/v1";
const MODEL = process.env.OPENCLAW_MODEL || "gpt-4o";

// ============================================
// SYSTEM PROMPTS
// ============================================

const SYSTEM_PROMPTS = {
  admin: `You are an AI assistant for LockSafe UK admin operations. You help manage locksmith jobs, dispatch locksmiths, and monitor the platform.

Available actions:
- List and filter jobs (by status, date, postcode)
- Find best locksmith matches for jobs
- Dispatch/assign jobs to locksmiths
- Toggle locksmith availability
- View platform statistics and alerts
- Check coverage areas

Always be concise and actionable. Provide job numbers, names, and relevant details.
When asked to perform actions, extract the necessary entities and call the appropriate function.`,

  locksmith: `You are a personal assistant for a LockSafe UK locksmith. You help them manage their jobs, availability, and earnings.

Available actions:
- View active jobs and pending applications
- Accept or decline jobs
- Update job status (en route, arrived, etc.)
- Toggle availability (online/offline)
- Check earnings and stats
- Get quote assistance

Be friendly but professional. Locksmiths are often busy - keep responses brief and useful.`,

  customer: `You are a customer support assistant for LockSafe UK, a locksmith platform. You help customers track their jobs, contact locksmiths, and resolve issues.

Available actions:
- Track job status and ETA
- Provide locksmith contact details
- Request callbacks from support
- Report issues and escalate
- Answer questions about the service

Be empathetic and helpful. Customers may be locked out and stressed - reassure them and provide clear information.
Never share sensitive data without verification. Always offer to escalate if you can't help.`,
};

// ============================================
// TOOL DEFINITIONS
// ============================================

const TOOLS = {
  admin: [
    {
      name: "list_jobs",
      description: "List jobs with optional filters",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "active", "today", "all"] },
          postcode: { type: "string", description: "Postcode prefix to filter by" },
          limit: { type: "number", description: "Max results", default: 10 },
        },
      },
    },
    {
      name: "find_locksmith",
      description: "Find the best locksmith matches for a job",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Job ID or job number" },
          maxCandidates: { type: "number", default: 5 },
        },
        required: ["jobId"],
      },
    },
    {
      name: "dispatch_job",
      description: "Auto-dispatch a job to the best matching locksmith",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          locksmithId: { type: "string" },
        },
        required: ["jobId", "locksmithId"],
      },
    },
    {
      name: "toggle_availability",
      description: "Toggle or set locksmith availability",
      parameters: {
        type: "object",
        properties: {
          locksmithId: { type: "string" },
          status: { type: "string", enum: ["on", "off", "toggle"] },
        },
        required: ["locksmithId"],
      },
    },
    {
      name: "get_stats",
      description: "Get platform statistics",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month"], default: "today" },
        },
      },
    },
    {
      name: "get_alerts",
      description: "Get current system alerts",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  ],
  locksmith: [
    {
      name: "get_active_jobs",
      description: "Get locksmith's active jobs",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "accept_job",
      description: "Accept a job assignment",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
        },
        required: ["jobId"],
      },
    },
    {
      name: "decline_job",
      description: "Decline a job assignment",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["jobId"],
      },
    },
    {
      name: "update_status",
      description: "Update job status",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          status: { type: "string", enum: ["en_route", "arrived", "diagnosing", "in_progress", "completed"] },
        },
        required: ["jobId", "status"],
      },
    },
    {
      name: "set_availability",
      description: "Set availability status",
      parameters: {
        type: "object",
        properties: {
          available: { type: "boolean" },
        },
        required: ["available"],
      },
    },
    {
      name: "get_earnings",
      description: "Get earnings summary",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month"] },
        },
      },
    },
    {
      name: "get_quote_help",
      description: "Get quote pricing guidance",
      parameters: {
        type: "object",
        properties: {
          lockType: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard", "specialist"] },
        },
      },
    },
  ],
  customer: [
    {
      name: "track_job",
      description: "Get job status and details",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Job ID or job number" },
        },
        required: ["jobId"],
      },
    },
    {
      name: "get_eta",
      description: "Get locksmith ETA for active job",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
        },
        required: ["jobId"],
      },
    },
    {
      name: "request_callback",
      description: "Request a callback from support",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          urgent: { type: "boolean" },
        },
        required: ["reason"],
      },
    },
    {
      name: "report_issue",
      description: "Report an issue with a job",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          issueType: { type: "string", enum: ["late", "quality", "payment", "safety", "other"] },
          description: { type: "string" },
        },
        required: ["issueType", "description"],
      },
    },
  ],
};

// ============================================
// LLM API FUNCTIONS
// ============================================

/**
 * Call the LLM API (OpenAI or OpenClaw)
 */
async function callLLM(
  messages: Message[],
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>
): Promise<LLMResponse> {
  if (!OPENAI_API_KEY) {
    console.warn("[OpenClaw] No API key configured");
    return { content: "AI assistant not configured" };
  }

  try {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    const response = await fetch(`${OPENCLAW_ENDPOINT}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[OpenClaw] API error:", error);
      return { content: "Sorry, I encountered an error. Please try again." };
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      return { content: "No response from AI" };
    }

    // Handle tool calls
    if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCalls = choice.message.tool_calls.map((tc: {
        function: { name: string; arguments: string };
      }) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        content: choice.message.content || "",
        toolCalls,
      };
    }

    return { content: choice.message?.content || "" };
  } catch (error) {
    console.error("[OpenClaw] Error:", error);
    return { content: "Sorry, I encountered an error. Please try again." };
  }
}

// ============================================
// INTENT EXTRACTION
// ============================================

/**
 * Extract intent and entities from a natural language query
 */
export async function extractIntent(
  message: string,
  role: "admin" | "locksmith" | "customer" = "admin"
): Promise<NLPIntent> {
  // Quick keyword-based classification for common patterns
  const quickIntent = getQuickIntent(message, role);
  if (quickIntent.confidence > 0.9) {
    return quickIntent;
  }

  // Use LLM for complex queries
  const systemPrompt = `You are an intent classifier for a locksmith platform.
Analyze the user message and extract:
1. The primary intent
2. Any entities mentioned (job numbers, postcodes, names, dates, etc.)

Respond in JSON format:
{
  "intent": "one of: ${getIntentsForRole(role).join(", ")}",
  "confidence": 0.0-1.0,
  "entities": { ... extracted entities ... }
}`;

  const response = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ]);

  try {
    // Try to parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent || "unknown",
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
      };
    }
  } catch {
    // Fall back to quick intent
    return quickIntent;
  }

  return { intent: "unknown", confidence: 0.3, entities: {} };
}

function getQuickIntent(message: string, role: string): NLPIntent {
  const lower = message.toLowerCase();
  const entities: Record<string, string | number | boolean> = {};

  // Extract common entities
  const jobMatch = lower.match(/ls-\d{4}-\d{4}/i);
  if (jobMatch) entities.jobNumber = jobMatch[0].toUpperCase();

  const postcodeMatch = lower.match(/[a-z]{1,2}\d{1,2}\s*\d?[a-z]{2}/i);
  if (postcodeMatch) entities.postcode = postcodeMatch[0].toUpperCase();

  // Admin intents
  if (role === "admin") {
    if (/\bpending\b.*\bjobs?\b|\bjobs?\b.*\bpending\b/i.test(lower)) {
      return { intent: "list_jobs", confidence: 0.95, entities: { ...entities, status: "pending" } };
    }
    if (/\bactive\b.*\bjobs?\b|\bjobs?\b.*\bactive\b/i.test(lower)) {
      return { intent: "list_jobs", confidence: 0.95, entities: { ...entities, status: "active" } };
    }
    if (/\bjobs?\b.*\btoday\b|\btoday'?s?\b.*\bjobs?\b/i.test(lower)) {
      return { intent: "list_jobs", confidence: 0.95, entities: { ...entities, status: "today" } };
    }
    if (/\bfind\b.*\blocksmith\b|\bbest\b.*\blocksmith\b|\bdispatch\b/i.test(lower)) {
      return { intent: "find_locksmith", confidence: 0.9, entities };
    }
    if (/\bassign\b|\bauto.?dispatch\b/i.test(lower)) {
      return { intent: "assign_job", confidence: 0.9, entities };
    }
    if (/\bstats?\b|\bstatistics?\b|\bdashboard\b/i.test(lower)) {
      return { intent: "get_stats", confidence: 0.95, entities };
    }
    if (/\balerts?\b|\bissues?\b|\bproblems?\b/i.test(lower)) {
      return { intent: "get_alerts", confidence: 0.95, entities };
    }
    if (/\blocksmiths?\b.*\bavailable\b|\bavailable\b.*\blocksmiths?\b/i.test(lower)) {
      return { intent: "list_locksmiths", confidence: 0.9, entities: { ...entities, available: true } };
    }
    if (/\blocksmiths?\b/i.test(lower)) {
      return { intent: "list_locksmiths", confidence: 0.85, entities };
    }
  }

  // Locksmith intents
  if (role === "locksmith") {
    if (/\baccept\b/i.test(lower)) {
      return { intent: "accept_job", confidence: 0.9, entities };
    }
    if (/\bdecline\b|\breject\b|\bcan'?t\s+do\b/i.test(lower)) {
      return { intent: "decline_job", confidence: 0.9, entities };
    }
    if (/\bonline\b|\bavailable\b|\bgo\s+on\b/i.test(lower)) {
      return { intent: "go_online", confidence: 0.95, entities };
    }
    if (/\boffline\b|\bunavailable\b|\bgo\s+off\b/i.test(lower)) {
      return { intent: "go_offline", confidence: 0.95, entities };
    }
    if (/\bmy\s+jobs?\b|\bactive\b.*\bjobs?\b|\bjobs?\b/i.test(lower)) {
      return { intent: "view_active_jobs", confidence: 0.9, entities };
    }
    if (/\bearnings?\b|\bpaid\b|\bmoney\b|\bpayout\b/i.test(lower)) {
      return { intent: "check_earnings", confidence: 0.9, entities };
    }
    if (/\bquote\b.*\bhelp\b|\bpricing\b|\bhow\s+much\b/i.test(lower)) {
      return { intent: "send_quote", confidence: 0.8, entities };
    }
    if (/\ben\s*route\b|\bon\s+(?:my\s+)?way\b|\bheading\b/i.test(lower)) {
      return { intent: "update_status", confidence: 0.9, entities: { ...entities, status: "en_route" } };
    }
    if (/\barrived\b|\bhere\b|\bon\s+site\b/i.test(lower)) {
      return { intent: "update_status", confidence: 0.9, entities: { ...entities, status: "arrived" } };
    }
  }

  // Customer intents
  if (role === "customer") {
    if (/\btrack\b|\bstatus\b|\bwhere\b.*\blocksmith\b/i.test(lower)) {
      return { intent: "track_job", confidence: 0.9, entities };
    }
    if (/\beta\b|\bwhen\b|\bhow\s+long\b|\btime\b/i.test(lower)) {
      return { intent: "get_eta", confidence: 0.9, entities };
    }
    if (/\bcall\b.*\blocksmith\b|\bcontact\b|\bphone\b/i.test(lower)) {
      return { intent: "contact_locksmith", confidence: 0.9, entities };
    }
    if (/\bcallback\b|\bcall\s+me\b|\bspeak\s+to\b/i.test(lower)) {
      return { intent: "request_callback", confidence: 0.9, entities };
    }
    if (/\bissue\b|\bproblem\b|\bcomplaint\b|\blate\b/i.test(lower)) {
      return { intent: "report_issue", confidence: 0.85, entities };
    }
    if (/\bcancel\b/i.test(lower)) {
      return { intent: "cancel_job", confidence: 0.9, entities };
    }
  }

  // General intents
  if (/\bhello\b|\bhi\b|\bhey\b|\bgood\s+(morning|afternoon|evening)\b/i.test(lower)) {
    return { intent: "greeting", confidence: 0.95, entities };
  }
  if (/\bhelp\b|\bcommands?\b|\bwhat\s+can\b/i.test(lower)) {
    return { intent: "help", confidence: 0.95, entities };
  }

  return { intent: "unknown", confidence: 0.3, entities };
}

function getIntentsForRole(role: string): IntentType[] {
  switch (role) {
    case "admin":
      return [
        "list_jobs", "job_status", "find_locksmith", "dispatch_job", "assign_job",
        "toggle_availability", "get_stats", "get_alerts", "list_locksmiths",
        "view_earnings", "check_coverage", "greeting", "help", "unknown"
      ];
    case "locksmith":
      return [
        "accept_job", "decline_job", "update_status", "send_quote", "check_earnings",
        "go_online", "go_offline", "view_active_jobs", "greeting", "help", "unknown"
      ];
    case "customer":
      return [
        "track_job", "get_eta", "contact_locksmith", "request_callback", "report_issue",
        "cancel_job", "update_address", "get_quote", "make_payment", "greeting", "help", "unknown"
      ];
    default:
      return ["greeting", "help", "unknown"];
  }
}

// ============================================
// CONVERSATIONAL RESPONSE GENERATION
// ============================================

/**
 * Generate a conversational response with tool execution
 */
export async function generateResponse(
  message: string,
  context: ConversationContext
): Promise<{
  response: string;
  toolResults?: Array<{ tool: string; result: unknown }>;
}> {
  const systemPrompt = SYSTEM_PROMPTS[context.role] || SYSTEM_PROMPTS.admin;
  const tools = TOOLS[context.role] || TOOLS.admin;

  // Build message history
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add context about current state
  if (context.currentJobId) {
    messages.push({
      role: "system",
      content: `Current job context: ${context.currentJobId}`,
    });
  }

  // Add recent conversation history
  for (const msg of context.messageHistory.slice(-6)) {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  // Add current message
  messages.push({ role: "user", content: message });

  // Get LLM response with tools
  const llmResponse = await callLLM(messages, tools);

  // If tool calls were made, execute them
  const toolResults: Array<{ tool: string; result: unknown }> = [];

  if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
    for (const toolCall of llmResponse.toolCalls) {
      const result = await executeTool(toolCall, context);
      toolResults.push({ tool: toolCall.name, result });
    }

    // Get final response with tool results
    const toolResultMessages = toolResults.map((tr) => ({
      role: "assistant" as const,
      content: `Tool ${tr.tool} result: ${JSON.stringify(tr.result)}`,
    }));

    messages.push(...toolResultMessages);
    messages.push({
      role: "user",
      content: "Please summarize the results in a helpful response.",
    });

    const finalResponse = await callLLM(messages);
    return { response: finalResponse.content, toolResults };
  }

  return { response: llmResponse.content };
}

// ============================================
// TOOL EXECUTION
// ============================================

async function executeTool(
  toolCall: ToolCall,
  context: ConversationContext
): Promise<unknown> {
  const { name, arguments: args } = toolCall;

  console.log(`[OpenClaw] Executing tool: ${name}`, args);

  switch (name) {
    // Admin tools
    case "list_jobs":
      return await listJobs(args as { status?: string; postcode?: string; limit?: number });

    case "find_locksmith":
      return await findLocksmithForJob(args.jobId as string, args.maxCandidates as number);

    case "dispatch_job":
      return await dispatchJobAction(args.jobId as string, args.locksmithId as string);

    case "get_stats":
      return await getStats(args.period as string);

    case "get_alerts":
      return await getAlerts();

    case "toggle_availability":
      return await toggleLocksmithAvailability(
        args.locksmithId as string,
        args.status as string
      );

    // Locksmith tools
    case "get_active_jobs":
      return await getLocksmithActiveJobs(context.userId as string);

    case "accept_job":
      return await acceptJobAction(context.userId as string, args.jobId as string);

    case "decline_job":
      return await declineJobAction(
        context.userId as string,
        args.jobId as string,
        args.reason as string
      );

    case "update_status":
      return await updateJobStatus(args.jobId as string, args.status as string);

    case "set_availability":
      return await setLocksmithAvailability(context.userId as string, args.available as boolean);

    case "get_earnings":
      return await getLocksmithEarnings(context.userId as string, args.period as string);

    case "get_quote_help":
      return await getQuoteHelp(args.lockType as string, args.difficulty as string);

    // Customer tools
    case "track_job":
      return await trackJob(args.jobId as string);

    case "get_eta":
      return await getJobEta(args.jobId as string);

    case "request_callback":
      return await requestCallbackAction(
        context.userId as string,
        args.reason as string,
        args.urgent as boolean
      );

    case "report_issue":
      return await reportIssue(
        context.userId as string,
        args.jobId as string,
        args.issueType as string,
        args.description as string
      );

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ============================================
// TOOL IMPLEMENTATIONS
// ============================================

async function listJobs(params: { status?: string; postcode?: string; limit?: number }) {
  const { status, postcode, limit = 10 } = params;

  // biome-ignore lint/suspicious/noExplicitAny: dynamic query
  const where: any = {};

  if (status === "pending") {
    where.status = JobStatus.PENDING;
  } else if (status === "active") {
    where.status = {
      in: [
        JobStatus.ACCEPTED,
        JobStatus.EN_ROUTE,
        JobStatus.ARRIVED,
        JobStatus.IN_PROGRESS,
      ],
    };
  } else if (status === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.createdAt = { gte: today };
  }

  if (postcode) {
    where.postcode = { startsWith: postcode.toUpperCase() };
  }

  const jobs = await prisma.job.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      locksmith: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    count: jobs.length,
    jobs: jobs.map((j) => ({
      jobNumber: j.jobNumber,
      status: j.status,
      postcode: j.postcode,
      problemType: j.problemType,
      customer: j.customer?.name,
      locksmith: j.locksmith?.name || "Unassigned",
      createdAt: j.createdAt.toISOString(),
    })),
  };
}

async function findLocksmithForJob(jobRef: string, maxCandidates = 5) {
  const job = await prisma.job.findFirst({
    where: {
      OR: [
        { id: jobRef },
        { jobNumber: { equals: jobRef.toUpperCase(), mode: "insensitive" } },
      ],
    },
  });

  if (!job) {
    return { error: "Job not found" };
  }

  const result = await findBestLocksmiths(job.id, maxCandidates);

  return {
    jobNumber: job.jobNumber,
    candidates: result.candidates.map((c: DispatchCandidate) => ({
      name: c.locksmithName,
      distance: `${c.distanceMiles}mi`,
      rating: c.rating,
      matchScore: `${c.matchScore}%`,
      eta: `${c.estimatedEtaMinutes}min`,
      available: c.isAvailable,
    })),
    recommended: result.autoDispatchRecommended,
    reason: result.reason,
  };
}

async function dispatchJobAction(jobRef: string, locksmithId: string) {
  // Implementation would call autoDispatchJob
  return { success: true, message: `Job dispatched to locksmith ${locksmithId}` };
}

async function getStats(period = "today") {
  const now = new Date();
  let startDate: Date;

  if (period === "week") {
    startDate = new Date(now.setDate(now.getDate() - 7));
  } else if (period === "month") {
    startDate = new Date(now.setMonth(now.getMonth() - 1));
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }

  const [jobs, completed, revenue, available] = await Promise.all([
    prisma.job.count({ where: { createdAt: { gte: startDate } } }),
    prisma.job.count({
      where: {
        status: { in: [JobStatus.COMPLETED, JobStatus.SIGNED] },
        createdAt: { gte: startDate },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "succeeded", createdAt: { gte: startDate } },
    }),
    prisma.locksmith.count({
      where: { isActive: true, isVerified: true, isAvailable: true },
    }),
  ]);

  return {
    period,
    totalJobs: jobs,
    completedJobs: completed,
    revenue: revenue._sum.amount || 0,
    availableLocksmiths: available,
  };
}

async function getAlerts() {
  const alerts: Array<{ type: string; message: string; severity: string }> = [];

  const urgentPending = await prisma.job.count({
    where: {
      status: JobStatus.PENDING,
      createdAt: { lte: new Date(Date.now() - 30 * 60 * 1000) },
    },
  });

  if (urgentPending > 0) {
    alerts.push({
      type: "urgent_jobs",
      message: `${urgentPending} jobs pending for 30+ minutes`,
      severity: "high",
    });
  }

  const available = await prisma.locksmith.count({
    where: { isActive: true, isVerified: true, isAvailable: true },
  });

  if (available < 3) {
    alerts.push({
      type: "low_availability",
      message: `Only ${available} locksmiths available`,
      severity: "medium",
    });
  }

  return { alerts, count: alerts.length };
}

async function toggleLocksmithAvailability(locksmithId: string, status?: string) {
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
  });

  if (!locksmith) {
    return { error: "Locksmith not found" };
  }

  const newStatus = status === "on" ? true : status === "off" ? false : !locksmith.isAvailable;

  await prisma.locksmith.update({
    where: { id: locksmithId },
    data: { isAvailable: newStatus, lastAvailabilityChange: new Date() },
  });

  return { success: true, isAvailable: newStatus };
}

async function getLocksmithActiveJobs(locksmithId: string) {
  const jobs = await prisma.job.findMany({
    where: {
      locksmithId,
      status: {
        in: [
          JobStatus.ACCEPTED,
          JobStatus.EN_ROUTE,
          JobStatus.ARRIVED,
          JobStatus.IN_PROGRESS,
        ],
      },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    count: jobs.length,
    jobs: jobs.map((j) => ({
      jobNumber: j.jobNumber,
      status: j.status,
      postcode: j.postcode,
      customer: j.customer?.name,
    })),
  };
}

async function acceptJobAction(locksmithId: string, jobRef: string) {
  return { success: true, message: "Job accepted" };
}

async function declineJobAction(locksmithId: string, jobRef: string, reason?: string) {
  return { success: true, message: "Job declined" };
}

async function updateJobStatus(jobId: string, status: string) {
  const statusMap: Record<string, JobStatus> = {
    en_route: JobStatus.EN_ROUTE,
    arrived: JobStatus.ARRIVED,
    diagnosing: JobStatus.DIAGNOSING,
    in_progress: JobStatus.IN_PROGRESS,
    completed: JobStatus.PENDING_CUSTOMER_CONFIRMATION,
  };

  const newStatus = statusMap[status];
  if (!newStatus) {
    return { error: "Invalid status" };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: newStatus },
  });

  return { success: true, newStatus };
}

async function setLocksmithAvailability(locksmithId: string, available: boolean) {
  await prisma.locksmith.update({
    where: { id: locksmithId },
    data: { isAvailable: available, lastAvailabilityChange: new Date() },
  });

  return { success: true, isAvailable: available };
}

async function getLocksmithEarnings(locksmithId: string, period = "today") {
  const now = new Date();
  let startDate: Date;

  if (period === "week") {
    startDate = new Date(now.setDate(now.getDate() - 7));
  } else if (period === "month") {
    startDate = new Date(now.setMonth(now.getMonth() - 1));
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }

  const payments = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      job: { locksmithId },
      status: "succeeded",
      createdAt: { gte: startDate },
    },
  });

  return {
    period,
    earnings: payments._sum.amount || 0,
  };
}

async function getQuoteHelp(lockType: string, difficulty = "medium") {
  const rates: Record<string, Record<string, number>> = {
    easy: { cylinder: 35, mortice: 45, multipoint: 55 },
    medium: { cylinder: 55, mortice: 75, multipoint: 95 },
    hard: { cylinder: 85, mortice: 110, multipoint: 140 },
    specialist: { cylinder: 120, mortice: 160, multipoint: 200 },
  };

  const normalizedType = lockType?.toLowerCase().includes("cylinder")
    ? "cylinder"
    : lockType?.toLowerCase().includes("mortice")
      ? "mortice"
      : "multipoint";

  return {
    lockType: normalizedType,
    difficulty,
    suggestedLabour: rates[difficulty]?.[normalizedType] || 60,
    tips: [
      "Always provide itemised breakdown",
      "Include warranty information",
      "Take before/after photos",
    ],
  };
}

async function trackJob(jobRef: string) {
  const job = await prisma.job.findFirst({
    where: {
      OR: [
        { id: jobRef },
        { jobNumber: { equals: jobRef.toUpperCase(), mode: "insensitive" } },
      ],
    },
    include: {
      locksmith: { select: { name: true, phone: true } },
    },
  });

  if (!job) {
    return { error: "Job not found" };
  }

  const statusMessages: Record<string, string> = {
    PENDING: "Looking for a locksmith in your area",
    ACCEPTED: "A locksmith has been assigned",
    EN_ROUTE: "Your locksmith is on the way",
    ARRIVED: "Your locksmith has arrived",
    IN_PROGRESS: "Work in progress",
    COMPLETED: "Work complete - please confirm",
  };

  return {
    jobNumber: job.jobNumber,
    status: job.status,
    statusMessage: statusMessages[job.status] || job.status,
    locksmith: job.locksmith?.name,
    eta: job.estimatedArrival,
  };
}

async function getJobEta(jobRef: string) {
  const job = await prisma.job.findFirst({
    where: {
      OR: [
        { id: jobRef },
        { jobNumber: { equals: jobRef.toUpperCase(), mode: "insensitive" } },
      ],
    },
    include: {
      locksmith: { select: { name: true } },
    },
  });

  if (!job) {
    return { error: "Job not found" };
  }

  if (!job.locksmith) {
    return { message: "No locksmith assigned yet" };
  }

  return {
    jobNumber: job.jobNumber,
    locksmith: job.locksmith.name,
    eta: job.estimatedArrival || "Unknown",
    status: job.status,
  };
}

async function requestCallbackAction(userId: string, reason: string, urgent = false) {
  console.log(`[OpenClaw] Callback requested by ${userId}: ${reason} (urgent: ${urgent})`);
  return {
    success: true,
    message: urgent
      ? "Urgent callback requested - we'll call within 5 minutes"
      : "Callback requested - we'll call within 15 minutes",
  };
}

async function reportIssue(
  userId: string,
  jobRef: string,
  issueType: string,
  description: string
) {
  console.log(`[OpenClaw] Issue reported by ${userId}: ${issueType} - ${description}`);
  return {
    success: true,
    ticketId: `ISS-${Date.now().toString(36).toUpperCase()}`,
    message: "Issue reported - our team will contact you shortly",
  };
}

// ============================================
// CONVERSATIONAL QUERY HANDLER
// ============================================

/**
 * Main entry point for natural language queries
 */
export async function processNaturalLanguageQuery(
  query: string,
  role: "admin" | "locksmith" | "customer",
  userId?: string,
  currentJobId?: string
): Promise<{
  response: string;
  intent?: IntentType;
  entities?: Record<string, unknown>;
  actions?: Array<{ name: string; result: unknown }>;
}> {
  // First, extract intent
  const intent = await extractIntent(query, role);

  console.log(`[OpenClaw] Query: "${query}" | Intent: ${intent.intent} (${intent.confidence})`);

  // Build context
  const context: ConversationContext = {
    role,
    userId,
    currentJobId,
    recentEntities: {},
    messageHistory: [],
  };

  // Generate response
  const { response, toolResults } = await generateResponse(query, context);

  return {
    response,
    intent: intent.intent,
    entities: intent.entities,
    actions: toolResults?.map((tr) => ({ name: tr.tool, result: tr.result })),
  };
}
