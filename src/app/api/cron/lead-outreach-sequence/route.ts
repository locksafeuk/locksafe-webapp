import { NextRequest, NextResponse } from "next/server";

type Track = "independent" | "manager";
type Style = "direct" | "benefit";

type SequenceResult = {
  touch: number;
  track: Track;
  style: Style;
  variant: number;
  sent: number;
  failed: number;
  attempted: number;
  message?: string;
};

function hasCronAuth(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

function pickStyle(date: Date): Style {
  return date.getUTCDate() % 2 === 0 ? "benefit" : "direct";
}

function pickVariant(date: Date): 1 | 2 | 3 {
  const n = (date.getUTCDate() % 3) + 1;
  return n as 1 | 2 | 3;
}

async function runTouch(baseUrl: string, authHeader: string, payload: {
  touch: 1 | 2 | 3;
  track: Track;
  style: Style;
  variant: 1 | 2 | 3;
}): Promise<SequenceResult> {
  const response = await fetch(`${baseUrl}/api/admin/leads/send-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: authHeader,
    },
    body: JSON.stringify({
      mode: "sequence",
      touch: payload.touch,
      track: payload.track,
      subjectStyle: payload.style,
      variant: payload.variant,
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      touch: payload.touch,
      track: payload.track,
      style: payload.style,
      variant: payload.variant,
      sent: 0,
      failed: 0,
      attempted: 0,
      message: data?.error || `HTTP ${response.status}`,
    };
  }

  return {
    touch: payload.touch,
    track: payload.track,
    style: payload.style,
    variant: payload.variant,
    sent: Number(data.sent || 0),
    failed: Number(data.failed || 0),
    attempted: Number(data.sequence?.attempted || 0),
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

export async function GET(request: NextRequest) {
  if (!hasCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is required" }, { status: 500 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.locksafe.uk").replace(/\/$/, "");
  const now = new Date();
  const style = pickStyle(now);
  const variant = pickVariant(now);
  const authHeader = `Bearer ${cronSecret}`;

  const jobs: Array<{ touch: 1 | 2 | 3; track: Track; style: Style; variant: 1 | 2 | 3 }> = [
    { touch: 1, track: "independent", style, variant },
    { touch: 1, track: "manager", style, variant },
    { touch: 2, track: "independent", style, variant },
    { touch: 2, track: "manager", style, variant },
    { touch: 3, track: "independent", style, variant },
    { touch: 3, track: "manager", style, variant },
  ];

  const results: SequenceResult[] = [];
  for (const job of jobs) {
    const result = await runTouch(baseUrl, authHeader, job);
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const summary = {
    attempted: results.reduce((sum, r) => sum + r.attempted, 0),
    sent: results.reduce((sum, r) => sum + r.sent, 0),
    failed: results.reduce((sum, r) => sum + r.failed, 0),
  };

  return NextResponse.json({
    success: true,
    runAt: now.toISOString(),
    style,
    variant,
    summary,
    results,
  });
}
