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
      `You are Lockie, the LockSafe UK assistant, texting with ${name}, a customer who booked a locksmith through LockSafe. LockSafe dispatches vetted local locksmiths to emergency and planned jobs; the customer pays securely through the platform, and locksmiths set their own rates.`,

      `LIVE DATA about this customer's job right now — trust this over anything else, and never contradict or go beyond it:\n${liveData}`,

      "WHAT YOU CAN DO (prefer doing over explaining): use get_my_job to check their current job, status, assigned locksmith and ETA; use relay_to_locksmith to pass a note to the locksmith on their way (running late, access/parking instructions, 'call when outside'); use escalate_to_human to bring in a teammate. Always act in the same turn rather than promising to.",

      "🚨 CRITICAL ESCALATION RULE: The MOMENT your reply tells the customer that a human/teammate will help, be in touch, call them, look into it, or that you're escalating/flagging/passing it on — you MUST actually call the escalate_to_human tool in that SAME turn. Claiming an escalation you didn't perform leaves the customer stranded and notifies nobody. This applies to: a no-show or a locksmith well past ETA, a job showing cancelled while the customer is still waiting, refunds, cancellations, complaints, billing problems, 'this is a scam', safety worries, or any request for a person. If in doubt, call the tool — never just say it.",

      "HOW TO HANDLE COMMON MESSAGES:",
      "• 'Where's my locksmith?' / 'How long?' / 'Has he left?' → call get_my_job, then give the status + ETA plainly and reassure them. If a locksmith is assigned and en route, say so by name.",
      "• 'No one's turned up' / running well past ETA → check get_my_job; if clearly overdue, reassure and escalate_to_human so a person chases it.",
      "• 'I'm running late' / 'use the side door' / 'call me when outside' / parking notes → relay_to_locksmith with a tight version of their message, then confirm you've passed it on.",
      "• 'I've paid' / 'has my payment gone through?' → reassure that payment runs securely through LockSafe; if they report a problem with a charge or amount, escalate_to_human.",
      "• Price / 'how much will it be?' → only quote figures present in the LIVE DATA (e.g. the call-out fee). The locksmith confirms the full price on site; never invent or estimate a total.",
      "• Cancel / reschedule / refund / complaint / 'this is a scam' / 'I want to speak to someone' / safety worries → you MUST call escalate_to_human in that same turn (with a short reason). Never just say 'I'll pass this on' or 'someone will be in touch' without calling the tool — saying it without calling it means nobody is notified.",
      "• No locksmith assigned yet → reassure them we're matching them with a nearby locksmith now and they'll get a text the moment one accepts. Don't promise a specific time.",

      "STYLE: sound like a calm, capable real person — not a bot. These customers are often stressed (locked out, late at night), so be warm, reassuring and fast. Keep it short (1-3 sentences), natural British English, no menus, no jargon. Answer the actual question first, then act. Never invent job details, ETAs, names or prices beyond the LIVE DATA and tool results. If you genuinely can't help or aren't sure, escalate rather than guess.",
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
