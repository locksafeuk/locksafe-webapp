import { prisma } from "@/lib/db";

type TranscriptMessage = {
  role: string;
  content: string;
};

type VoiceCallDatasetRow = {
  callId: string;
  startedAt: string;
  durationSeconds: number | null;
  callCategory: string | null;
  urgencyLevel: string | null;
  outcome: string | null;
  sentimentLabel: string | null;
  wasEscalated: boolean;
  transcript: TranscriptMessage[];
  summary: string | null;
};

export type DatasetExportResult = {
  generatedAt: string;
  filters: {
    from: string | null;
    to: string | null;
    limit: number;
    includeTestCalls: boolean;
  };
  totals: {
    calls: number;
    withTranscript: number;
    withOutcome: number;
  };
  rows: VoiceCallDatasetRow[];
};

function maskPhone(input: string): string {
  return input.replace(/\+?\d[\d\s\-()]{7,}\d/g, "[PHONE]");
}

function maskEmail(input: string): string {
  return input.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]");
}

function maskPostcode(input: string): string {
  return input.replace(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/gi, "[POSTCODE]");
}

function maskAddressHints(input: string): string {
  return input.replace(/\b\d{1,4}\s+[A-Za-z][A-Za-z\s]{1,30}\b/g, "[ADDRESS]");
}

export function maskSensitiveText(input: string): string {
  let text = input;
  text = maskEmail(text);
  text = maskPhone(text);
  text = maskPostcode(text);
  text = maskAddressHints(text);
  return text;
}

function toTranscriptMessages(rawTranscript: unknown): TranscriptMessage[] {
  if (!Array.isArray(rawTranscript)) return [];

  return rawTranscript
    .map((item: unknown) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const role = typeof record.role === "string" ? record.role : "unknown";
      const content = typeof record.content === "string" ? record.content : "";
      if (!content.trim()) return null;
      return {
        role,
        content: maskSensitiveText(content),
      };
    })
    .filter((message: TranscriptMessage | null): message is TranscriptMessage => Boolean(message));
}

export async function exportMaskedRetellDataset(params: {
  from?: Date;
  to?: Date;
  limit?: number;
  includeTestCalls?: boolean;
}): Promise<DatasetExportResult> {
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  const includeTestCalls = Boolean(params.includeTestCalls);

  const where: Record<string, unknown> = {
    transcript: { not: null },
  };

  if (!includeTestCalls) {
    where.isTestCall = false;
  }

  if (params.from || params.to) {
    where.startedAt = {};
    if (params.from) {
      (where.startedAt as Record<string, unknown>).gte = params.from;
    }
    if (params.to) {
      (where.startedAt as Record<string, unknown>).lte = params.to;
    }
  }

  const calls = await prisma.voiceCall.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      startedAt: true,
      durationSeconds: true,
      callCategory: true,
      urgencyLevel: true,
      outcome: true,
      sentimentLabel: true,
      wasEscalated: true,
      transcript: true,
      summary: true,
    },
  });

  const rows: VoiceCallDatasetRow[] = calls.map((call) => ({
    callId: call.id,
    startedAt: call.startedAt.toISOString(),
    durationSeconds: call.durationSeconds,
    callCategory: call.callCategory,
    urgencyLevel: call.urgencyLevel,
    outcome: call.outcome,
    sentimentLabel: call.sentimentLabel,
    wasEscalated: call.wasEscalated,
    transcript: toTranscriptMessages(call.transcript),
    summary: call.summary ? maskSensitiveText(call.summary) : null,
  }));

  const withOutcome = rows.filter((row) => Boolean(row.outcome)).length;
  const withTranscript = rows.filter((row) => row.transcript.length > 0).length;

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      from: params.from ? params.from.toISOString() : null,
      to: params.to ? params.to.toISOString() : null,
      limit,
      includeTestCalls,
    },
    totals: {
      calls: rows.length,
      withTranscript,
      withOutcome,
    },
    rows,
  };
}