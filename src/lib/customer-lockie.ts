/**
 * Customer Lockie — the agentic assistant for CUSTOMERS over two-way SMS (and
 * reusable for WhatsApp). Same brain/pattern as the locksmith bot
 * (qwen3:32b + tools, single-hop execution, confirm-gating, dry-run), but a
 * customer persona and customer-appropriate tools.
 *
 * Returns the reply text (the caller sends it); returns null only if the model
 * is unreachable. NEVER sends anything itself unless a tool is invoked.
 */

import prisma from "@/lib/db";
import { chat, Models, type LLMMessage, type OllamaTool } from "@/lib/llm-router";
import { getCustomerByPhone } from "@/lib/customer-service";
import { sendSMS } from "@/lib/sms";
import { sendAdminAlert } from "@/lib/telegram";

const CUSTOMER_TOOLS: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "get_my_job",
      description: "The customer's most recent job: number, status, assigned locksmith, ETA, postcode, fee.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "relay_to_locksmith",
      description:
        "Pass a short message from the customer to the locksmith assigned to their job (e.g. 'running 10 min late', 'use the side door', 'call when outside'). Only if a locksmith is assigned.",
      parameters: {
        type: "object",
        properties: { message: { type: "string", description: "What to tell the locksmith" } },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_human",
      description:
        "Hand off to a human teammate. Use for refunds, complaints, cancellations, payment/billing problems, safety concerns, or when they ask for a person.",
      parameters: { type: "object", properties: { reason: { type: "string" } } },
    },
  },
];

type CustomerJob = {
  jobNumber: string;
  status: string;
  problemType: string;
  postcode: string;
  estimatedArrival: string | null;
  assessmentFee: number | null;
  locksmith: { name: string; phone: string } | null;
};

async function getLatestJob(customerId: string): Promise<CustomerJob | null> {
  const job = await prisma.job.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      jobNumber: true,
      status: true,
      problemType: true,
      postcode: true,
      estimatedArrival: true,
      assessmentFee: true,
      locksmith: { select: { name: true, phone: true } },
    },
  });
  return job as CustomerJob | null;
}

async function executeCustomerTool(
  customerId: string,
  customerName: string,
  customerPhone: string,
  toolName: string,
  args: Record<string, unknown>,
  dryRun: boolean,
): Promise<string> {
  try {
    switch (toolName) {
      case "get_my_job": {
        const job = await getLatestJob(customerId);
        if (!job) return JSON.stringify({ job: null });
        return JSON.stringify({
          jobNumber: job.jobNumber,
          status: job.status,
          problemType: job.problemType,
          postcode: job.postcode,
          eta: job.estimatedArrival,
          assessmentFee: job.assessmentFee,
          locksmith: job.locksmith?.name ?? null,
        });
      }
      case "relay_to_locksmith": {
        const note = String(args.message ?? "").trim();
        if (!note) return "No message to relay.";
        const job = await getLatestJob(customerId);
        if (!job?.locksmith?.phone) return "No locksmith is assigned to this job yet, so there's no one to relay to.";
        if (dryRun) return `(dry run) would tell ${job.locksmith.name}: "${note}"`;
        await sendSMS(
          job.locksmith.phone,
          `LockSafe UK: Message from your customer on ${job.jobNumber}: "${note}"`,
          { channel: "transactional", logContext: `customer-relay:${job.jobNumber}` },
        );
        return `Relayed to ${job.locksmith.name}.`;
      }
      case "escalate_to_human": {
        const reason = String(args.reason ?? "").trim();
        if (dryRun) return "(dry run) would flag this to the LockSafe team for a human to pick up.";
        const job = await getLatestJob(customerId);
        await sendAdminAlert({
          title: `🆘 ${customerName || "Customer"} needs a human (SMS)`,
          message:
            `${customerName || "A customer"} asked for human help via SMS.\n` +
            `Contact: ${customerPhone}\n` +
            (job ? `Job: ${job.jobNumber} [${job.status}]\n` : "") +
            (reason ? `About: ${reason}\n` : "") +
            `Jump into the conversation to reply.`,
          severity: "warning",
          topic: "agents",
          dedupeKey: `customer-escalation:${customerPhone}`,
          cooldownMsOverride: 15 * 60 * 1000,
        }).catch(() => {});
        return "DONE: flagged for the LockSafe team — a human will reply right here.";
      }
      default:
        return "Unknown tool.";
    }
  } catch (e) {
    return `Tool error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function handleCustomerLockie(
  phone: string,
  text: string,
  opts: { dryRun?: boolean; historyOverride?: LLMMessage[]; traceSink?: string[] } = {},
): Promise<string | null> {
  const dryRun = opts.dryRun === true;
  const customer = await getCustomerByPhone(phone);
  const name = customer?.name?.split(" ")[0] || "there";

  const job = customer ? await getLatestJob(customer.id) : null;
  const liveData = job
    ? `Latest job: ${job.jobNumber} — status ${job.status}, ${job.problemType} @ ${job.postcode}` +
      (job.locksmith ? `, locksmith ${job.locksmith.name}` : ", no locksmith assigned yet") +
      (job.estimatedArrival ? `, ETA ${job.estimatedArrival}` : "") +
      (job.assessmentFee != null ? `, call-out fee £${job.assessmentFee}` : "")
    : customer
      ? "No jobs on record for this customer yet."
      : "This number isn't linked to a known customer record.";

  const system: LLMMessage = {
    role: "system",
    content: [
      `You are Lockie, the LockSafe UK assistant, texting with ${name}, a customer who booked an emergency/planned locksmith. LockSafe dispatches vetted locksmiths; payment runs through the platform.`,
      `LIVE DATA (trust over anything else):\n${liveData}`,
      "You can DO things: check their job, relay a message to their assigned locksmith (e.g. they'll be late, or access notes), or escalate to a human. Prefer doing over explaining.",
      "Refunds, complaints, cancellations, billing/payment problems, safety worries, or anything you can't resolve → you MUST call escalate_to_human in that same turn. Never just say 'I'll pass this on' without calling the tool.",
      "STYLE: a real person, not a bot. Short (1-3 sentences), natural British English, warm and calm — customers texting are often stressed (locked out). Answer first, then act. Never invent job details, ETAs, or prices beyond the LIVE DATA / tools.",
    ].join("\n\n"),
  };

  const baseMessages: LLMMessage[] = [
    system,
    ...(opts.historyOverride ?? []),
    { role: "user", content: text },
  ];

  const first = await chat(Models.QUALITY, baseMessages, {
    temperature: 0.5,
    maxTokens: 350,
    timeoutMs: 15_000,
    allowOpenAIFallback: true,
    thinkingMode: "no_think",
    tools: CUSTOMER_TOOLS,
  });
  if (!first) return null;

  if (!first.toolCalls || first.toolCalls.length === 0) {
    return first.content?.trim() || null;
  }

  const results: string[] = [];
  for (const tc of first.toolCalls.slice(0, 4)) {
    const out = await executeCustomerTool(
      customer?.id ?? "",
      customer?.name ?? "",
      phone,
      tc.name,
      tc.arguments ?? {},
      dryRun || !customer, // no customer record → never mutate, just answer
    );
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
          "You just used internal tools to handle the message above. Reply to the customer naturally using these results — do NOT mention tools, functions, or JSON. If a result reports a block or error, explain it warmly and say what happens next.\n\n" +
          results.join("\n"),
      },
    ],
    { temperature: 0.5, maxTokens: 350, timeoutMs: 15_000, allowOpenAIFallback: true, thinkingMode: "no_think" },
  );

  return followup?.content?.trim() || results.join("\n") || null;
}
