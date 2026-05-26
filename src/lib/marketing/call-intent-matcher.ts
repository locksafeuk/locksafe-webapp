/**
 * Call-Intent Matcher
 *
 * Bridges between a Retell inbound-call event and the CallIntent row
 * that captured the click which drove that call. The match flow:
 *
 *   visitor clicks Call →
 *     POST /api/marketing/call-intent  (CallIntent row created with gclid)
 *   tel: opens, user is connected via Zadarma → Retell →
 *     Retell webhook fires here →
 *       matchInboundCall() finds the freshest unmatched intent for
 *       this visitor (or, when visitorId is unknown, the freshest
 *       unmatched intent system-wide within MATCH_WINDOW_MS).
 *
 * Why TWO strategies (visitor-scoped + global recent):
 *   The reliable join key is visitorId — set client-side via localStorage,
 *   passed by the call button on the same device. But Retell doesn't see
 *   visitorId; it only knows the inbound number and timestamp. So the
 *   webhook has to pass any context it has (visitorId via SIP header if
 *   we ever wire that, OR the caller-ID number) and let this matcher
 *   resolve.
 *
 * Conservative defaults: MATCH_WINDOW_MS = 5 minutes. After that, a call
 * is no longer matched to a stale click — better to under-attribute than
 * stamp the wrong row.
 */

import { prisma as _prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

/**
 * Time window inside which an inbound Retell call may be matched to a
 * preceding CallIntent. 5 minutes captures the typical "click Call →
 * dialler app opens → call connects → Retell receives it" latency with
 * comfortable slack for slower devices / networks.
 */
export const MATCH_WINDOW_MS = 5 * 60 * 1000;

export interface InboundCallEvent {
  /** Retell's call ID. Required. */
  retellCallId: string;
  /** When the call connected (ISO string or Date). Required. */
  callStartedAt: string | Date;
  /**
   * Optional visitor ID — present only when we've wired Retell to pass
   * it via SIP header / dynamic variables. If absent, we fall back to
   * the freshest-within-window strategy.
   */
  visitorId?: string;
  /** Inbound caller number in E.164 — stored for audit, not used as join key. */
  callerIdE164?: string;
}

export interface MatchResult {
  matched:    boolean;
  intentId?:  string;
  strategy?:  "visitor_scoped" | "global_recent";
  reason:     string;
}

/**
 * Match a Retell inbound call back to a CallIntent. Writes the matched
 * fields onto the CallIntent row in the SAME query so two concurrent
 * Retell events can't double-claim the same intent.
 *
 * Returns the match result + the matched intent's id (if any). When
 * no intent matches within MATCH_WINDOW_MS, returns {matched: false}.
 */
export async function matchInboundCall(event: InboundCallEvent): Promise<MatchResult> {
  const startedAt = event.callStartedAt instanceof Date
    ? event.callStartedAt
    : new Date(event.callStartedAt);

  if (Number.isNaN(startedAt.getTime())) {
    return { matched: false, reason: "invalid callStartedAt" };
  }

  const windowStart = new Date(startedAt.getTime() - MATCH_WINDOW_MS);

  // Strategy 1: visitor-scoped — best join key when we have it
  if (event.visitorId) {
    const candidate = await prisma.callIntent.findFirst({
      where: {
        visitorId:  event.visitorId,
        matched:    false,
        createdAt:  { gte: windowStart, lte: startedAt },
      },
      orderBy: { createdAt: "desc" },
      select:  { id: true },
    });
    if (candidate) {
      const updated = await stampMatch(candidate.id, event);
      if (updated) {
        return {
          matched:  true,
          intentId: candidate.id,
          strategy: "visitor_scoped",
          reason:   `matched on visitorId within ${MATCH_WINDOW_MS / 1000}s window`,
        };
      }
      // The row was matched by someone else between our find + update
      // (e.g. two parallel webhook deliveries). Fall through to global.
    }
  }

  // Strategy 2: global-recent — last-resort when we have no visitorId.
  // Risky: if two visitors clicked Call within the same minute and we
  // can't tell them apart, the matcher will pick whichever was more
  // recent. We accept this trade-off because under-attribution silently
  // costs us the conversion credit, whereas mis-attribution is rare
  // (would require two simultaneous calls from the same campaign).
  const fallback = await prisma.callIntent.findFirst({
    where: {
      matched:    false,
      createdAt:  { gte: windowStart, lte: startedAt },
    },
    orderBy: { createdAt: "desc" },
    select:  { id: true },
  });
  if (fallback) {
    const updated = await stampMatch(fallback.id, event);
    if (updated) {
      return {
        matched:  true,
        intentId: fallback.id,
        strategy: "global_recent",
        reason:   `matched on freshest-within-window (no visitorId)`,
      };
    }
  }

  return {
    matched: false,
    reason:  `no unmatched CallIntent found within ${MATCH_WINDOW_MS / 1000}s of call start`,
  };
}

/**
 * Atomically stamp a match. Uses updateMany with the matched=false
 * predicate so two parallel webhooks can't both claim the same row —
 * the second one's updateMany returns count=0 and we fall back.
 */
async function stampMatch(
  intentId: string,
  event:    InboundCallEvent,
): Promise<boolean> {
  const result = await prisma.callIntent.updateMany({
    where: {
      id:      intentId,
      matched: false,
    },
    data: {
      matched:      true,
      matchedAt:    new Date(),
      retellCallId: event.retellCallId,
      callerIdE164: event.callerIdE164,
    },
  });
  return (result.count ?? 0) > 0;
}

/**
 * Read the matched CallIntent for a Job (via Job.callIntentId, set by
 * the booking flow when a call-led job is created). Returns null when
 * no intent is linked (e.g. job came from the website form, not a
 * phone call). Used by the conversion upload path.
 */
export async function getCallIntentForJob(jobId: string): Promise<{
  id: string;
  gclid: string | null;
  fbclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  retellCallId: string | null;
} | null> {
  // The Job model isn't extended in this commit — we look up by
  // CallIntent.jobId instead. When we wire the booking flow to stamp
  // CallIntent.jobId on call-led jobs, this resolves cleanly.
  const intent = await prisma.callIntent.findFirst({
    where:  { jobId },
    select: {
      id: true, gclid: true, fbclid: true,
      utmSource: true, utmMedium: true, utmCampaign: true,
      utmContent: true, utmTerm: true, retellCallId: true,
    },
  });
  return intent;
}
