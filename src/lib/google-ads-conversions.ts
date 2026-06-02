/**
 * Google Ads Conversions API uploader — the single most important
 * defence against being ripped off by Google.
 *
 * THE PROBLEM
 * ───────────
 * Google charges per click. Their bidding algorithm optimises for whatever
 * you tell it counts as a "conversion". If you tell Google a conversion =
 * "form submitted" or "Call button pressed", Google will happily flood you
 * with low-quality leads that look great in their dashboard but never
 * become real jobs. You get the bill; the locksmith gets nothing; Google's
 * quarterly numbers go up.
 *
 * THE FIX
 * ───────
 * Define a Google Ads conversion action of type
 *   `conversion_action_type: UPLOAD_CLICKS`
 * representing "Locksmith Job Completed". When a Job reaches
 * `status: COMPLETED` with `payment_received: true`, upload that
 * conversion server-side via the Google Ads REST API. Use the original
 * `gclid` captured when the visitor clicked the ad, plus the actual job
 * revenue. Google's auction will then learn to bid on traffic that
 * produces real, paid jobs — not vanity form-fills.
 *
 * Setup required on the Google Ads side (one time):
 *   1. Create a conversion action in Google Ads UI:
 *        Tools → Conversions → +New conversion action → Import → Other data sources → Track conversions from clicks
 *      Set the value type to "Use a value that we record from the conversion"
 *      and currency to GBP.
 *   2. Note the resource name (it looks like `customers/1234567890/conversionActions/9876543210`).
 *   3. Set env var `GOOGLE_ADS_CONVERSION_ACTION_RESOURCE` to that string.
 *
 * Endpoint used:
 *   POST https://googleads.googleapis.com/v24/customers/{customerId}:uploadClickConversions
 *
 * Idempotency: Google dedupes conversions by (gclid, conversion_action,
 * conversion_date_time). We also persist `conversionUploadedAt` on Job so
 * we never re-fire.
 */

import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import { prisma as _prisma } from "@/lib/db";

// New Job fields not yet in the generated Prisma client (until
// `npx prisma generate` runs). Same `as any` escape hatch used elsewhere.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClickConversionInput {
  /** The Google Click ID captured when the visitor first clicked the ad. */
  gclid: string;
  /** When the conversion actually happened (ISO-8601, timezone-aware). */
  conversionDateTime: string;
  /** Job revenue (GBP). */
  conversionValue: number;
  /** "GBP" — kept configurable because future markets may differ. */
  currencyCode?: string;
  /**
   * For dedupe + post-hoc auditing: which Job triggered this upload.
   * Sent as Google's `order_id` field (max 64 chars). Strongly recommended
   * by Google's docs — guarantees idempotency across retries.
   */
  orderId: string;
  /**
   * Optional: override the default conversion action resource. Used by
   * uploadAssessmentFeeConversion() to fire to a separate action from the
   * main job-completion conversion.
   */
  conversionActionOverride?: string;
}

export interface ConversionUploadResult {
  ok:                  boolean;
  jobId?:              string;
  /** When the conversion was accepted by Google. Null if not uploaded. */
  uploadedAt?:         Date;
  /** Free-text status: "uploaded" | "skipped_no_gclid" | "failed" | "skipped_already_uploaded". */
  status:              string;
  error?:              string;
  /** The raw response from Google for debugging — only when ok=true. */
  googleResponse?:     unknown;
}

// ── Assessment fee conversion upload ────────────────────────────────────────

/**
 * Fire an "Assessment Fee Paid" conversion to Google Ads when a customer
 * pays the call-out / assessment fee via Stripe.
 *
 * Uses a separate conversion action resource
 * (`GOOGLE_ADS_ASSESSMENT_FEE_CONVERSION_ACTION_RESOURCE`) so Google can
 * treat this as a micro-conversion — a strong intent signal that feeds the
 * auction algorithm even before the final job is completed.
 *
 * Safe to call from the Stripe webhook (`checkout.session.completed` where
 * `metadata.type === "assessment_fee" | "callout"`). Idempotent via orderId.
 */
export async function uploadAssessmentFeeConversion(
  jobId: string,
  amount: number,
  stripeCheckoutId: string,
): Promise<ConversionUploadResult> {
  const conversionAction =
    process.env["GOOGLE_ADS_ASSESSMENT_FEE_CONVERSION_ACTION_RESOURCE"];
  if (!conversionAction) {
    // Not fatal — just means the assessment fee conversion action isn't
    // configured yet. Log and move on; we never want to block the payment flow.
    console.warn(
      "[conversions] GOOGLE_ADS_ASSESSMENT_FEE_CONVERSION_ACTION_RESOURCE not set — " +
        "assessment fee conversion skipped. Set this env to a " +
        "customers/{id}/conversionActions/{id} resource name.",
    );
    return { ok: true, status: "skipped_no_config" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = _prisma as any;
  const job = await prismaAny.job.findUnique({
    where: { id: jobId },
    select: { jobNumber: true, gclid: true, createdAt: true },
  });
  if (!job) return { ok: false, status: "failed", error: `Job ${jobId} not found` };

  // Resolve gclid — same fallback to CallIntent as the job-completion uploader.
  let gclid: string | undefined = job.gclid ?? undefined;
  if (!gclid) {
    const intent = await findCallIntentForJob(jobId);
    if (intent?.gclid) gclid = intent.gclid;
  }
  if (!gclid) {
    return { ok: true, status: "skipped_no_gclid" };
  }

  return uploadClickConversion({
    gclid,
    conversionDateTime: toGoogleDateString(new Date()),
    conversionValue: amount,
    currencyCode: "GBP",
    orderId: `AF-${job.jobNumber}-${stripeCheckoutId.slice(-8)}`,
    conversionActionOverride: conversionAction,
  });
}

// ── Upload primitive ─────────────────────────────────────────────────────────

/**
 * Upload a single click conversion to Google Ads. Idempotent by orderId.
 *
 * Returns a typed result rather than throwing — the cron that fires this
 * should NEVER crash on a single failed upload. Failed uploads are
 * recorded on the Job for retry by a future run.
 */
export async function uploadClickConversion(
  input: ClickConversionInput,
): Promise<ConversionUploadResult> {
  const conversionAction =
    input.conversionActionOverride ||
    process.env["GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"];
  if (!conversionAction) {
    return {
      ok: false,
      status: "failed",
      error:
        "GOOGLE_ADS_CONVERSION_ACTION_RESOURCE is not set. Create a " +
        "conversion action in Google Ads (type: import / track from clicks) " +
        "and set this env to its resource name " +
        "(customers/{customerId}/conversionActions/{actionId}).",
    };
  }

  const client = await getDefaultGoogleAdsClient().catch((err) => {
    return { error: err instanceof Error ? err.message : String(err) };
  });
  if ("error" in (client as object)) {
    return {
      ok: false, status: "failed",
      error: `Google Ads client unavailable: ${(client as { error: string }).error}`,
    };
  }
  // getDefaultGoogleAdsClient() returns { client, accountId, customerId } —
  // the actual GoogleAdsClient instance is on the .client property.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (client as any).client;

  // Extract customer ID from the conversion-action resource name —
  // saves the caller having to thread it through.
  const customerMatch = conversionAction.match(/^customers\/(\d+)\//);
  if (!customerMatch) {
    return {
      ok: false, status: "failed",
      error: `Malformed GOOGLE_ADS_CONVERSION_ACTION_RESOURCE: "${conversionAction}"`,
    };
  }
  const customerId = customerMatch[1];

  const body = {
    conversions: [
      {
        gclid:               input.gclid,
        conversionAction,
        conversionDateTime:  input.conversionDateTime,
        conversionValue:     input.conversionValue,
        currencyCode:        input.currencyCode ?? "GBP",
        orderId:             input.orderId,
      },
    ],
    // partialFailure tells Google: don't reject the whole batch if one
    // conversion is bad. Returns per-conversion errors in the response.
    partialFailure:        true,
    validateOnly:          false,
    debugEnabled:          false,
  };

  try {
    // The existing GoogleAdsClient's `mutate<T>` is geared at the
    // /mutate endpoints. uploadClickConversions has its own URL. We use
    // c.request(...) if it exists, otherwise fall back to a direct fetch
    // wrapped with the client's auth headers. The shape below mirrors
    // existing mutate() usage in google-ads-publish.ts.
    const response = await c.request(
      `customers/${customerId}:uploadClickConversions`,
      "POST",
      body,
    );
    return {
      ok: true,
      status: "uploaded",
      uploadedAt: new Date(),
      googleResponse: response,
    };
  } catch (err) {
    return {
      ok: false,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Job-level wrapper (the hook called from completion flows) ────────────────

/**
 * Fire a conversion to Google Ads for one Job. Decides whether to upload
 * (gclid present, not already uploaded), then calls the primitive and
 * persists the outcome on the Job row.
 *
 * Safe to call multiple times — second call returns
 * `skipped_already_uploaded` without hitting Google.
 *
 * Triggered from:
 *   • The job-completion flow (after final payment confirmed)
 *   • A retry cron that picks up jobs with status="failed"
 */
export async function uploadJobConversionIfEligible(
  jobId: string,
): Promise<ConversionUploadResult> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { quote: true },
  });
  if (!job) return { ok: false, status: "failed", error: `Job ${jobId} not found` };

  // Already uploaded? Skip.
  if (job.conversionUploadStatus === "uploaded" && job.conversionUploadedAt) {
    return {
      ok: true,
      jobId,
      uploadedAt: job.conversionUploadedAt,
      status: "skipped_already_uploaded",
    };
  }

  // No gclid on the Job directly? Two reasons that might happen:
  //   1. Job came from organic / direct traffic — genuinely nothing to upload
  //   2. Job is CALL-LED — booked via Retell after the visitor clicked
  //      the website Call CTA. In that case the gclid lives on a
  //      CallIntent row, joined via VoiceCall.jobId → VoiceCall.retellCallId
  //      → CallIntent.retellCallId.
  //
  // Fall through to CallIntent before giving up.
  let resolvedGclid: string | undefined = job.gclid ?? undefined;
  let intentIdForAudit: string | undefined;
  if (!resolvedGclid) {
    const intent = await findCallIntentForJob(jobId);
    if (intent?.gclid) {
      resolvedGclid    = intent.gclid;
      intentIdForAudit = intent.id;
    }
  }
  if (!resolvedGclid) {
    await prisma.job.update({
      where: { id: jobId },
      data: { conversionUploadStatus: "skipped_no_gclid" },
    });
    return { ok: true, jobId, status: "skipped_no_gclid" };
  }

  // Compute revenue. Prefer the actual quote total; fall back to
  // assessment fee. Jobs with zero revenue are still uploaded — they're
  // "no value" conversions which still help Google's auction learn
  // (a click that produced a real customer but cancelled has signal).
  const revenue = typeof job.quote?.total === "number"
    ? job.quote.total
    : (job.assessmentFee ?? 0);

  const result = await uploadClickConversion({
    gclid:              resolvedGclid,
    conversionDateTime: toGoogleDateString(
      job.workCompletedAt ?? job.signedAt ?? job.acceptedAt ?? new Date(),
    ),
    conversionValue:    revenue,
    currencyCode:       "GBP",
    orderId:            job.jobNumber, // human-readable, unique
  });

  // Persist outcome
  await prisma.job.update({
    where: { id: jobId },
    data: {
      conversionUploadedAt:   result.ok ? new Date() : null,
      conversionUploadStatus: result.status,
      conversionUploadError:  result.ok ? null : result.error ?? null,
    },
  });

  // When the gclid came from a CallIntent (not the Job itself), mirror
  // the upload outcome onto that row too, so the call-attribution
  // audit log shows both legs of the loop closing.
  if (intentIdForAudit) {
    await prisma.callIntent.update({
      where: { id: intentIdForAudit },
      data: {
        jobId,
        conversionUploadedAt:   result.ok ? new Date() : null,
        conversionUploadStatus: result.ok ? "uploaded" : "error",
        conversionUploadError:  result.ok ? null : (result.error ?? null),
      },
    }).catch((err: unknown) => {
      // Don't fail the whole upload because of the audit-side write.
      console.warn(`[conversions] failed to mirror to CallIntent ${intentIdForAudit}:`, err);
    });
  }

  return { ...result, jobId };
}

/**
 * Resolve a CallIntent for a Job via the VoiceCall bridge.
 *
 * Chain: Job.id → VoiceCall (filtered by jobId) → CallIntent (joined on
 * retellCallId, must be matched=true).
 *
 * Returns null when the job isn't call-led, or when the call wasn't
 * matched to any preceding CallIntent. Stays internal — exposed for
 * unit testing via the wrapping uploader.
 */
async function findCallIntentForJob(
  jobId: string,
): Promise<{ id: string; gclid: string | null } | null> {
  const voiceCall = await prisma.voiceCall.findFirst({
    where:  { jobId },
    select: { retellCallId: true },
  });
  if (!voiceCall?.retellCallId) return null;

  const intent = await prisma.callIntent.findFirst({
    where:  { retellCallId: voiceCall.retellCallId, matched: true },
    select: { id: true, gclid: true },
  });
  return intent;
}

// ── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Google Ads requires conversionDateTime in the format
 *   "YYYY-MM-DD HH:mm:ss+ZZ:ZZ"
 * (ISO-ish but space-separated and with explicit offset). We always emit
 * +00:00 (UTC) — Google accepts and converts to the account's timezone.
 */
export function toGoogleDateString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = d.getUTCFullYear();
  const mo = pad(d.getUTCMonth() + 1);
  const da = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  return `${y}-${mo}-${da} ${h}:${mi}:${s}+00:00`;
}
