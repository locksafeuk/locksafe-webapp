/**
 * Messaging delivery-health check (WhatsApp + SMS).
 *
 * Why this exists: a batch of WhatsApp sends failed with Twilio Error 63016
 * ("outside the 24h window — use a template") and NOBODY was alerted, because
 * nothing watched outbound delivery. WhatsApp is the primary onboarding channel,
 * so a silent delivery failure means locksmiths go dark with no signal to us.
 *
 * This runs read-only:
 *   1. Scans Twilio's recent Messages for failed/undelivered sends and tallies
 *      the error codes (so a systemic problem like 63016 or exhausted credit
 *      surfaces immediately, with a plain-English hint).
 *   2. Checks the active WhatsApp provider is actually able to send: for Meta,
 *      that the templates the code relies on exist and are APPROVED.
 *
 * No messages are sent. Consumed by /api/cron/messaging-health-monitor.
 */

type CheckState = "ok" | "warn" | "fail";

export interface MessagingHealthResult {
  status: "healthy" | "degraded" | "unhealthy";
  provider: string;
  twilio: {
    state: CheckState;
    windowHours: number;
    failed: number;
    delivered: number;
    total: number;
    byErrorCode: Array<{ code: string; count: number; hint: string }>;
    message: string;
  };
  whatsappTemplates: {
    state: CheckState;
    required: string[];
    missing: string[];
    message: string;
  };
}

// Plain-English hints for the Twilio error codes we actually care about.
const ERROR_HINTS: Record<string, string> = {
  "63016": "Free-form WhatsApp sent outside the 24h window — must use an approved template.",
  "63018": "WhatsApp rate limit hit.",
  "63021": "WhatsApp message blocked by the recipient.",
  "63024": "Invalid WhatsApp template / parameters.",
  "63051": "WhatsApp number not registered for messaging.",
  "21408": "No international permission for this destination.",
  "21610": "Recipient has unsubscribed (replied STOP).",
  "30007": "Carrier filtered the message as spam.",
  "30034": "Sender number not A2P-registered.",
  "63003": "Channel/sender could not be found (sender not configured).",
};
const hintFor = (code: string) => ERROR_HINTS[code] ?? "See Twilio error code reference.";

// Codes that mean a *systemic* delivery break (not just one bad number), so any
// meaningful volume of them should page us even below the generic threshold.
const SYSTEMIC_CODES = new Set(["63016", "63003", "63051", "30034", "63024"]);

// Codes that mean a *bad recipient / data-quality* problem (not our system):
// invalid number, no geo permission, handset off/unreachable, landline/0800,
// recipient unsubscribed or blocked us. A pile of these means the LEAD LIST has
// junk numbers — it is NOT a messaging outage, so it must not page "BROKEN".
const RECIPIENT_CODES = new Set(["21211", "21408", "21610", "63021", "30003", "30005", "30006"]);

const GRAPH = "https://graph.facebook.com/v18.0";

function requiredTemplates(): string[] {
  const raw = process.env.REQUIRED_WHATSAPP_TEMPLATES;
  if (raw && raw.trim()) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  // The templates the code sends today (activation nudge + lead recruitment).
  return ["profile_incomplete_v1", "locksmith_recruit_invite"];
}

/** Scan recent Twilio messages for delivery failures. */
async function checkTwilio(windowHours: number): Promise<MessagingHealthResult["twilio"]> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const failThreshold = Math.max(1, Number(process.env.MESSAGING_FAIL_THRESHOLD || "5"));

  if (!accountSid || !authToken) {
    return {
      state: "warn",
      windowHours,
      failed: 0,
      delivered: 0,
      total: 0,
      byErrorCode: [],
      message: "Twilio credentials not configured — skipped delivery scan.",
    };
  }

  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  // Bound the result set by date (Twilio's filter is date-granular); we refine
  // to the precise window client-side. Newest messages are returned first.
  const sinceDate = new Date(cutoff).toISOString().slice(0, 10);
  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json` +
    `?DateSent%3E=${sinceDate}&PageSize=1000`;

  let messages: Array<Record<string, unknown>> = [];
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return {
        state: "warn",
        windowHours,
        failed: 0,
        delivered: 0,
        total: 0,
        byErrorCode: [],
        message: `Could not read Twilio messages (HTTP ${res.status}).`,
      };
    }
    const body = (await res.json()) as { messages?: Array<Record<string, unknown>> };
    messages = body.messages ?? [];
  } catch (err) {
    return {
      state: "warn",
      windowHours,
      failed: 0,
      delivered: 0,
      total: 0,
      byErrorCode: [],
      message: `Twilio scan errored: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const inWindow = messages.filter((m) => {
    const ts = Date.parse(String(m.date_sent ?? m.date_created ?? ""));
    return !Number.isNaN(ts) && ts >= cutoff;
  });

  let failed = 0;
  let delivered = 0;
  const codeCounts = new Map<string, number>();
  for (const m of inWindow) {
    const status = String(m.status ?? "");
    if (status === "failed" || status === "undelivered") {
      failed++;
      const code = m.error_code != null ? String(m.error_code) : "unknown";
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    } else if (status === "delivered" || status === "read" || status === "sent") {
      delivered++;
    }
  }

  const byErrorCode = [...codeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count, hint: hintFor(code) }));

  const systemicHits = byErrorCode
    .filter((e) => SYSTEMIC_CODES.has(e.code))
    .reduce((s, e) => s + e.count, 0);
  const recipientFailed = byErrorCode
    .filter((e) => RECIPIENT_CODES.has(e.code))
    .reduce((s, e) => s + e.count, 0);
  // Failures that point at OUR system (systemic + ambiguous), excluding clear
  // bad-recipient/data-quality ones. Only these should escalate to a page.
  const realFailed = failed - recipientFailed;
  const attempts = delivered + failed;
  const failRate = attempts > 0 ? failed / attempts : 0;

  // PAGE ("fail") only on a genuine delivery break: a cluster of systemic codes,
  // or a high failure RATE driven by non-recipient errors. A batch of texts to
  // landlines/invalid numbers (data quality) is a WARN, never a BROKEN page.
  let state: CheckState = "ok";
  if (systemicHits >= 3 || (realFailed >= failThreshold && failRate >= 0.3)) {
    state = "fail";
  } else if (failed > 0) {
    state = "warn";
  }

  const dataQualityHeavy = recipientFailed > 0 && recipientFailed >= realFailed;
  const message =
    state === "ok"
      ? `No delivery failures in the last ${windowHours}h (${delivered} delivered).`
      : dataQualityHeavy
        ? `${failed} of ${attempts} sends failed in ${windowHours}h, mostly invalid/landline/blocked numbers (lead-list data quality, not an outage).`
        : `${failed} failed/undelivered of ${attempts} in the last ${windowHours}h (${realFailed} system-side).`;

  return { state, windowHours, failed, delivered, total: inWindow.length, byErrorCode, message };
}

/** For Meta provider, confirm the templates the code sends are approved. */
async function checkWhatsappTemplates(provider: string): Promise<MessagingHealthResult["whatsappTemplates"]> {
  const required = requiredTemplates();

  if (provider !== "meta") {
    return {
      state: "ok",
      required,
      missing: [],
      message: `Provider is "${provider}"; Meta template approval check skipped.`,
    };
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!accessToken || !wabaId) {
    return {
      state: "fail",
      required,
      missing: required,
      message: "Provider is Meta but WHATSAPP_ACCESS_TOKEN / WHATSAPP_BUSINESS_ACCOUNT_ID is missing.",
    };
  }

  try {
    const url =
      `${GRAPH}/${wabaId}/message_templates` +
      `?fields=name,language,status,category&limit=200&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body = (await res.json()) as { data?: Array<{ name: string; status: string }> };
    if (!res.ok) {
      return {
        state: "warn",
        required,
        missing: [],
        message: `Could not read Meta templates (HTTP ${res.status}).`,
      };
    }
    const approved = new Set(
      (body.data ?? []).filter((t) => t.status === "APPROVED").map((t) => t.name),
    );
    const missing = required.filter((name) => !approved.has(name));
    return {
      state: missing.length > 0 ? "fail" : "ok",
      required,
      missing,
      message:
        missing.length > 0
          ? `Meta is the active provider but these templates aren't approved: ${missing.join(", ")} — those sends will fail.`
          : "All required WhatsApp templates are approved.",
    };
  } catch (err) {
    return {
      state: "warn",
      required,
      missing: [],
      message: `Meta template check errored: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function runMessagingHealthCheck(): Promise<MessagingHealthResult> {
  const provider = (process.env.WHATSAPP_PROVIDER || "meta").trim().toLowerCase();
  const windowHours = Math.max(1, Number(process.env.MESSAGING_HEALTH_WINDOW_HOURS || "24"));

  const [twilio, whatsappTemplates] = await Promise.all([
    checkTwilio(windowHours),
    checkWhatsappTemplates(provider),
  ]);

  const states = [twilio.state, whatsappTemplates.state];
  const status: MessagingHealthResult["status"] = states.includes("fail")
    ? "unhealthy"
    : states.includes("warn")
      ? "degraded"
      : "healthy";

  return { status, provider, twilio, whatsappTemplates };
}
