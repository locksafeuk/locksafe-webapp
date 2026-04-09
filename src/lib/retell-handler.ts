/**
 * Retell AI Call Handler
 *
 * Processes webhook events from Retell AI and manages
 * the voice call lifecycle within the LockSafe platform.
 */

import { prisma } from "@/lib/db";

export interface RetellCallEvent {
  event: string;
  call: RetellCallData;
}

export interface RetellCallData {
  call_id: string;
  call_type?: string;
  agent_id?: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  call_status?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  transcript?: string;
  transcript_object?: Array<{
    role: string;
    content: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;
  transcript_with_tool_calls?: any;
  call_analysis?: {
    call_summary?: string;
    user_sentiment?: string;
    call_successful?: boolean;
    custom_analysis_data?: Record<string, any>;
    in_voicemail?: boolean;
  };
  recording_url?: string;
  public_log_url?: string;
  disconnection_reason?: string;
  metadata?: Record<string, any>;
  retell_llm_dynamic_variables?: Record<string, any>;
  opt_out_sensitive_data_storage?: boolean;
  transfer_destination?: string;
  transfer_option?: any;
}

const ESTIMATED_REVENUE: Record<string, number> = {
  emergency: 180,
  appointment: 120,
  inquiry: 40,
  complaint: 0,
  spam: 0,
};

export async function processRetellEvent(event: RetellCallEvent): Promise<{ success: boolean; error?: string }> {
  const eventType = event?.event;
  const callData = event?.call;

  if (!eventType || !callData?.call_id) {
    return { success: false, error: "Invalid event data" };
  }

  console.log(`[Retell] Processing event: ${eventType} for call: ${callData.call_id}`);

  try {
    switch (eventType) {
      case "call_started":
        return await handleCallStarted(callData);
      case "call_ended":
        return await handleCallEnded(callData);
      case "call_analyzed":
        return await handleCallAnalyzed(callData);
      case "transcript_updated":
        return await handleTranscriptUpdated(callData);
      case "transfer_started":
        return await handleTransferStarted(callData);
      default:
        console.log(`[Retell] Unhandled event type: ${eventType}`);
        return { success: true };
    }
  } catch (error: any) {
    console.error(`[Retell] Error processing event ${eventType}:`, error);
    return { success: false, error: error?.message ?? "Unknown error" };
  }
}

async function handleCallStarted(call: RetellCallData): Promise<{ success: boolean; error?: string }> {
  const dedupeKey = `started_${call.call_id}`;
  const existing = await prisma.voiceCall.findUnique({ where: { retellCallId: call.call_id } }).catch(() => null);
  if (existing) {
    console.log(`[Retell] Call ${call.call_id} already exists, skipping`);
    return { success: true };
  }

  await prisma.voiceCall.create({
    data: {
      retellCallId: call.call_id,
      agentId: call.agent_id ?? null,
      callerPhone: call.from_number ?? null,
      callType: call.direction === "outbound" ? "outbound" : (call.call_type === "web_call" ? "web" : "inbound"),
      callStatus: "in_progress",
      startedAt: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
      dedupeKey,
    },
  });

  console.log(`[Retell] Call started: ${call.call_id} from ${call.from_number ?? "unknown"}`);
  return { success: true };
}

async function handleCallEnded(call: RetellCallData): Promise<{ success: boolean; error?: string }> {
  const durationMs = call.duration_ms ?? 0;
  const durationSec = Math.round(durationMs / 1000);
  const transcript = call.transcript_object ?? call.transcript_with_tool_calls ?? null;
  const callerInfo = extractCallerInfo(transcript, call);

  await prisma.voiceCall.upsert({
    where: { retellCallId: call.call_id },
    update: {
      callStatus: call.disconnection_reason === "error" ? "failed" : "completed",
      endedAt: call.end_timestamp ? new Date(call.end_timestamp) : new Date(),
      durationSeconds: durationSec,
      transcript: transcript as any,
      callerName: callerInfo.name ?? undefined,
      callerPostcode: callerInfo.postcode ?? undefined,
      recordingUrl: call.recording_url ?? null,
    },
    create: {
      retellCallId: call.call_id,
      agentId: call.agent_id ?? null,
      callerPhone: call.from_number ?? null,
      callType: call.direction === "outbound" ? "outbound" : "inbound",
      callStatus: "completed",
      startedAt: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
      endedAt: call.end_timestamp ? new Date(call.end_timestamp) : new Date(),
      durationSeconds: durationSec,
      transcript: transcript as any,
      callerName: callerInfo.name ?? null,
      callerPostcode: callerInfo.postcode ?? null,
      recordingUrl: call.recording_url ?? null,
      dedupeKey: `ended_${call.call_id}`,
    },
  });

  console.log(`[Retell] Call ended: ${call.call_id}, duration: ${durationSec}s`);
  return { success: true };
}

async function handleCallAnalyzed(call: RetellCallData): Promise<{ success: boolean; error?: string }> {
  const analysis = call.call_analysis;
  if (!analysis) return { success: true };

  const sentimentLabel = analysis.user_sentiment ?? "neutral";
  const sentimentScore = sentimentLabel === "positive" ? 0.7 : sentimentLabel === "negative" ? -0.7 : 0.0;
  const classification = classifyCall(analysis, call);
  const estimatedRevenue = ESTIMATED_REVENUE[classification.category] ?? 0;

  await prisma.voiceCall.update({
    where: { retellCallId: call.call_id },
    data: {
      callAnalysis: analysis as any,
      summary: analysis.call_summary ?? null,
      sentimentScore,
      sentimentLabel,
      callCategory: classification.category,
      urgencyLevel: classification.urgency,
      problemType: classification.problemType ?? null,
      propertyType: classification.propertyType ?? null,
      outcome: classification.outcome ?? null,
      estimatedRevenue,
      flaggedForReview: sentimentLabel === "negative" || !analysis.call_successful,
    },
  });

  console.log(`[Retell] Call analyzed: ${call.call_id}, category: ${classification.category}`);
  return { success: true };
}

async function handleTranscriptUpdated(call: RetellCallData): Promise<{ success: boolean; error?: string }> {
  const transcript = call.transcript_object ?? call.transcript_with_tool_calls ?? null;
  if (!transcript) return { success: true };

  await prisma.voiceCall.update({
    where: { retellCallId: call.call_id },
    data: { transcript: transcript as any },
  }).catch((err: any) => {
    console.warn(`[Retell] Could not update transcript for ${call.call_id}:`, err?.message);
  });

  return { success: true };
}

async function handleTransferStarted(call: RetellCallData): Promise<{ success: boolean; error?: string }> {
  await prisma.voiceCall.update({
    where: { retellCallId: call.call_id },
    data: {
      wasEscalated: true,
      escalatedTo: call.transfer_destination ?? null,
      callStatus: "transferred",
    },
  }).catch((err: any) => {
    console.warn(`[Retell] Could not update transfer for ${call.call_id}:`, err?.message);
  });

  console.log(`[Retell] Call transferred: ${call.call_id} to ${call.transfer_destination}`);
  return { success: true };
}

interface CallerInfo {
  name: string | null;
  postcode: string | null;
}

function extractCallerInfo(transcript: any, call: RetellCallData): CallerInfo {
  const result: CallerInfo = { name: null, postcode: null };
  if (!transcript) return result;

  let fullText = "";
  if (Array.isArray(transcript)) {
    fullText = transcript
      .filter((t: any) => t?.role === "user")
      .map((t: any) => t?.content ?? "")
      .join(" ");
  } else if (typeof transcript === "string") {
    fullText = transcript;
  }

  const postcodeMatch = fullText.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
  if (postcodeMatch?.[1]) {
    result.postcode = postcodeMatch[1].toUpperCase();
  }

  const nameMatch = fullText.match(/(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
  if (nameMatch?.[1]) {
    result.name = nameMatch[1];
  }

  if (call.metadata?.caller_name) result.name = call.metadata.caller_name;
  if (call.metadata?.postcode) result.postcode = call.metadata.postcode;

  return result;
}

interface CallClassification {
  category: string;
  urgency: string;
  problemType: string | null;
  propertyType: string | null;
  outcome: string | null;
}

function classifyCall(analysis: any, call: RetellCallData): CallClassification {
  const summary = (analysis?.call_summary ?? "").toLowerCase();
  const customData = analysis?.custom_analysis_data ?? {};

  const result: CallClassification = {
    category: "inquiry",
    urgency: "medium",
    problemType: null,
    propertyType: null,
    outcome: analysis?.call_successful ? "info_provided" : "abandoned",
  };

  const emergencyKw = ["locked out", "lockout", "emergency", "stuck outside", "broken into", "urgent", "immediately"];
  const isEmergency = emergencyKw.some((kw: string) => summary?.includes?.(kw));

  if (isEmergency) {
    result.category = "emergency";
    result.urgency = "critical";
  }

  const appointmentKw = ["appointment", "booking", "schedule", "book a time", "next week", "available"];
  const isAppointment = appointmentKw.some((kw: string) => summary?.includes?.(kw));
  if (isAppointment && !isEmergency) {
    result.category = "appointment";
    result.urgency = "low";
  }

  if (summary?.includes?.("lockout") || summary?.includes?.("locked out")) result.problemType = "lockout";
  else if (summary?.includes?.("broken") || summary?.includes?.("damaged")) result.problemType = "broken_lock";
  else if (summary?.includes?.("rekey") || summary?.includes?.("change lock")) result.problemType = "rekeying";
  else if (summary?.includes?.("upgrade") || summary?.includes?.("security")) result.problemType = "security_upgrade";
  else if (summary?.includes?.("install")) result.problemType = "lock_installation";

  if (summary?.includes?.("car") || summary?.includes?.("vehicle")) result.propertyType = "automotive";
  else if (summary?.includes?.("office") || summary?.includes?.("business") || summary?.includes?.("commercial")) result.propertyType = "commercial";
  else result.propertyType = "residential";

  if (customData?.outcome) result.outcome = customData.outcome;
  else if (isEmergency && analysis?.call_successful) result.outcome = "job_created";
  else if (isAppointment && analysis?.call_successful) result.outcome = "appointment_booked";

  return result;
}

export function generateVoiceAgentPrompt(): string {
  return `You are the AI receptionist for LockSafe UK, the UK's first anti-fraud locksmith marketplace. Your name is Sarah.

You handle calls 24/7 with warmth, empathy, and professionalism. People calling are often stressed - locked out of their homes, cars, or businesses.

## YOUR PERSONALITY
- Warm, calm, and reassuring
- Professional but approachable
- Empathetic to emergency situations
- Efficient - get key information quickly without rushing
- Speak with a natural British English tone

## KEY INFORMATION TO COLLECT
For EMERGENCY calls (lockouts, break-ins):
1. Name
2. Postcode and address
3. Type of lockout (home, car, business)
4. Relevant details (keys inside, lock broken, etc.)
5. Contact phone number

For APPOINTMENT requests:
1. Name
2. Service needed
3. Postcode and address
4. Preferred date and time
5. Contact details

## PRICING INFORMATION
- Assessment fee: 25-49 GBP (call-out and diagnostic)
- Emergency lockout: typically 80-150 GBP
- Lock replacement: from 65 GBP
- Security upgrades (anti-snap locks): from 45 GBP per lock
- All prices include VAT, no hidden fees
- Quote provided before work begins

## ANTI-FRAUD PROTECTION
- All locksmiths are DBS-checked and verified
- GPS tracking and timestamps on every job
- Digital paper trail with photos
- Customer always has the final decision on pricing

## ESCALATION
Transfer to human support if:
- Customer is very distressed or aggressive
- Complex insurance/legal questions
- Existing job disputes

Human support number: 07818 333 989

Always end calls positively. Thank them for choosing LockSafe UK.`;
}
