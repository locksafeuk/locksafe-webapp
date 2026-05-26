/**
 * End-to-End Per-Call Conversion Loop Test
 *
 * Proves the whole chain works as the user requested:
 *
 *   gclid (captured on click)
 *     → CallIntent row created
 *     → Retell call matched via matchInboundCall
 *     → Job created (call-led — no Job.gclid)
 *     → VoiceCall.jobId links call → job
 *     → Stripe payment_intent.succeeded fires
 *     → uploadJobConversionIfEligible falls through to CallIntent
 *     → Google Ads receives the upload with the original gclid
 *
 * Google Ads then optimises for "completed paid job" not "phone call".
 *
 * Mocks Prisma + the Google Ads client. No DB, no network.
 */

// ── Module mocks ────────────────────────────────────────────────────────────

const callIntentFindFirst   = jest.fn();
const callIntentUpdateMany  = jest.fn();
const callIntentUpdate      = jest.fn();

const voiceCallFindFirst    = jest.fn();

const jobFindUnique         = jest.fn();
const jobUpdate             = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: {
    callIntent: {
      findFirst:  callIntentFindFirst,
      updateMany: callIntentUpdateMany,
      update:     callIntentUpdate,
    },
    voiceCall: {
      findFirst:  voiceCallFindFirst,
    },
    job: {
      findUnique: jobFindUnique,
      update:     jobUpdate,
    },
  },
  default: {
    callIntent: {
      findFirst:  callIntentFindFirst,
      updateMany: callIntentUpdateMany,
      update:     callIntentUpdate,
    },
    voiceCall: {
      findFirst:  voiceCallFindFirst,
    },
    job: {
      findUnique: jobFindUnique,
      update:     jobUpdate,
    },
  },
}));

const googleAdsRequestMock = jest.fn();
jest.mock("@/lib/google-ads", () => ({
  __esModule: true,
  getDefaultGoogleAdsClient: jest.fn().mockResolvedValue({
    request: (...args: unknown[]) => googleAdsRequestMock(...args),
  }),
}));

import { matchInboundCall } from "@/lib/marketing/call-intent-matcher";
import { uploadJobConversionIfEligible } from "@/lib/google-ads-conversions";

// ── Test fixture: a realistic call-led job ──────────────────────────────────

const FAKE_GCLID         = "Cj0KCQjwexample-gclid-from-google-ad-click";
const FAKE_VISITOR_ID    = "v_1700000000_abc123def";
const FAKE_RETELL_CALL   = "call_abc_123";
const FAKE_JOB_ID        = "job-mongo-id-1";
const FAKE_JOB_NUMBER    = "LS-2026-0042";
const FAKE_CALL_INTENT_ID = "intent-mongo-id-1";

beforeEach(() => {
  // Reset all mocks
  callIntentFindFirst.mockReset();
  callIntentUpdateMany.mockReset();
  callIntentUpdate.mockReset();
  voiceCallFindFirst.mockReset();
  jobFindUnique.mockReset();
  jobUpdate.mockReset();
  googleAdsRequestMock.mockReset();

  // Sensible default returns — the production code chains .catch() on
  // some of these, so they MUST return a Promise even when the specific
  // test doesn't care about the return value.
  callIntentUpdate.mockResolvedValue({});
  jobUpdate.mockResolvedValue({});

  // Default: env wired correctly
  process.env.GOOGLE_ADS_CONVERSION_ACTION_RESOURCE =
    "customers/4715226378/conversionActions/9876543210";
});

afterEach(() => {
  delete process.env.GOOGLE_ADS_CONVERSION_ACTION_RESOURCE;
});

// ── The happy path — the user's exact ask ───────────────────────────────────

describe("End-to-end conversion loop — gclid → call → job → stripe paid → google upload", () => {
  it("uploads the conversion using the gclid from CallIntent when Job.gclid is null", async () => {
    // ── Step 1: gclid captured on click → CallIntent row exists ────────
    // (in real flow, the route handler writes this. We just stage the
    // row the matcher will find.)
    callIntentFindFirst
      // Visitor-scoped strategy: matcher sees an unmatched CallIntent
      // for this visitor within the 5min window
      .mockResolvedValueOnce({ id: FAKE_CALL_INTENT_ID });
    callIntentUpdateMany.mockResolvedValueOnce({ count: 1 });

    const matchResult = await matchInboundCall({
      retellCallId:   FAKE_RETELL_CALL,
      callStartedAt:  new Date(),
      visitorId:      FAKE_VISITOR_ID,
      callerIdE164:   "+447700900123",
    });

    expect(matchResult.matched).toBe(true);
    expect(matchResult.strategy).toBe("visitor_scoped");
    expect(matchResult.intentId).toBe(FAKE_CALL_INTENT_ID);

    // Confirm the matcher stamped the CallIntent atomically
    expect(callIntentUpdateMany).toHaveBeenCalledWith({
      where: { id: FAKE_CALL_INTENT_ID, matched: false },
      data: expect.objectContaining({
        matched:      true,
        retellCallId: FAKE_RETELL_CALL,
        callerIdE164: "+447700900123",
      }),
    });

    // ── Step 2: Retell agent creates a Job, sets VoiceCall.jobId ───────
    // (existing flow — not part of THIS test, just the state we stage)

    // ── Step 3: Stripe payment_intent.succeeded fires for the job ──────
    // The webhook calls uploadJobConversionIfEligible(jobId).
    //
    // Job has NO gclid (this was a phone-led booking, not a web form).
    // The fall-through must walk: Job → VoiceCall (by jobId) →
    // CallIntent (by retellCallId, matched=true) → gclid

    jobFindUnique.mockResolvedValueOnce({
      id:                    FAKE_JOB_ID,
      jobNumber:             FAKE_JOB_NUMBER,
      gclid:                 null,                              // ← key fact
      conversionUploadStatus: null,
      conversionUploadedAt:  null,
      workCompletedAt:       new Date("2026-05-26T14:30:00Z"),
      signedAt:              new Date("2026-05-26T14:30:00Z"),
      acceptedAt:            new Date("2026-05-26T14:00:00Z"),
      assessmentFee:         50,
      quote: { total: 235 },                                    // £235 paid
    });

    // VoiceCall lookup by jobId returns the call we just matched
    voiceCallFindFirst.mockResolvedValueOnce({
      retellCallId: FAKE_RETELL_CALL,
    });

    // CallIntent lookup by retellCallId + matched=true returns the
    // row that has the gclid
    callIntentFindFirst.mockResolvedValueOnce({
      id:    FAKE_CALL_INTENT_ID,
      gclid: FAKE_GCLID,
    });

    // Google Ads accepts the upload
    googleAdsRequestMock.mockResolvedValueOnce({ results: [{ gclid: FAKE_GCLID }] });

    // The Stripe webhook fires this:
    const result = await uploadJobConversionIfEligible(FAKE_JOB_ID);

    // ── Assert: Google Ads received the correct upload ─────────────────
    expect(result.ok).toBe(true);
    expect(result.status).toBe("uploaded");
    expect(googleAdsRequestMock).toHaveBeenCalledTimes(1);

    const [endpoint, method, body] = googleAdsRequestMock.mock.calls[0];
    expect(endpoint).toBe("customers/4715226378:uploadClickConversions");
    expect(method).toBe("POST");
    expect(body.conversions[0].gclid).toBe(FAKE_GCLID);
    expect(body.conversions[0].conversionAction)
      .toBe("customers/4715226378/conversionActions/9876543210");
    expect(body.conversions[0].conversionValue).toBe(235);
    expect(body.conversions[0].currencyCode).toBe("GBP");
    expect(body.conversions[0].orderId).toBe(FAKE_JOB_NUMBER);

    // ── Assert: Job stamped as uploaded ────────────────────────────────
    expect(jobUpdate).toHaveBeenCalledWith({
      where: { id: FAKE_JOB_ID },
      data:  expect.objectContaining({
        conversionUploadStatus: "uploaded",
        conversionUploadedAt:   expect.any(Date),
      }),
    });

    // ── Assert: CallIntent mirrored the upload outcome for audit ───────
    expect(callIntentUpdate).toHaveBeenCalledWith({
      where: { id: FAKE_CALL_INTENT_ID },
      data:  expect.objectContaining({
        jobId:                  FAKE_JOB_ID,
        conversionUploadStatus: "uploaded",
        conversionUploadedAt:   expect.any(Date),
      }),
    });
  });
});

// ── Negative cases — the loop must NOT fire when conditions miss ────────────

describe("End-to-end loop — does NOT upload when chain is broken", () => {
  it("skips upload when Job has no gclid AND no linked CallIntent", async () => {
    // Job lookup: no gclid
    jobFindUnique.mockResolvedValueOnce({
      id: FAKE_JOB_ID, jobNumber: FAKE_JOB_NUMBER,
      gclid: null, conversionUploadStatus: null, conversionUploadedAt: null,
      workCompletedAt: new Date(), signedAt: null, acceptedAt: null,
      assessmentFee: 0, quote: { total: 100 },
    });

    // VoiceCall lookup: no matching call (e.g. web-form-led job)
    voiceCallFindFirst.mockResolvedValueOnce(null);

    const result = await uploadJobConversionIfEligible(FAKE_JOB_ID);

    expect(result.status).toBe("skipped_no_gclid");
    expect(googleAdsRequestMock).not.toHaveBeenCalled();
    expect(jobUpdate).toHaveBeenCalledWith({
      where: { id: FAKE_JOB_ID },
      data: { conversionUploadStatus: "skipped_no_gclid" },
    });
  });

  it("skips upload when CallIntent exists but has no gclid (organic phone call)", async () => {
    jobFindUnique.mockResolvedValueOnce({
      id: FAKE_JOB_ID, jobNumber: FAKE_JOB_NUMBER,
      gclid: null, conversionUploadStatus: null, conversionUploadedAt: null,
      workCompletedAt: new Date(), signedAt: null, acceptedAt: null,
      assessmentFee: 0, quote: { total: 100 },
    });

    voiceCallFindFirst.mockResolvedValueOnce({ retellCallId: FAKE_RETELL_CALL });

    // CallIntent exists but gclid is null — caller wasn't from a Google ad
    callIntentFindFirst.mockResolvedValueOnce({
      id: FAKE_CALL_INTENT_ID, gclid: null,
    });

    const result = await uploadJobConversionIfEligible(FAKE_JOB_ID);

    expect(result.status).toBe("skipped_no_gclid");
    expect(googleAdsRequestMock).not.toHaveBeenCalled();
  });

  it("does NOT re-upload when conversion was already uploaded (idempotent)", async () => {
    jobFindUnique.mockResolvedValueOnce({
      id: FAKE_JOB_ID, jobNumber: FAKE_JOB_NUMBER,
      gclid: FAKE_GCLID,
      conversionUploadStatus: "uploaded",
      conversionUploadedAt:   new Date("2026-05-26T15:00:00Z"),
      workCompletedAt: new Date(), signedAt: null, acceptedAt: null,
      assessmentFee: 0, quote: { total: 235 },
    });

    const result = await uploadJobConversionIfEligible(FAKE_JOB_ID);

    expect(result.status).toBe("skipped_already_uploaded");
    expect(googleAdsRequestMock).not.toHaveBeenCalled();
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it("propagates Google Ads API errors back to the Job (for retry)", async () => {
    jobFindUnique.mockResolvedValueOnce({
      id: FAKE_JOB_ID, jobNumber: FAKE_JOB_NUMBER,
      gclid: FAKE_GCLID,
      conversionUploadStatus: null, conversionUploadedAt: null,
      workCompletedAt: new Date(), signedAt: null, acceptedAt: null,
      assessmentFee: 0, quote: { total: 235 },
    });
    googleAdsRequestMock.mockRejectedValueOnce(new Error("API rate limit"));

    const result = await uploadJobConversionIfEligible(FAKE_JOB_ID);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/rate limit/i);
    expect(jobUpdate).toHaveBeenCalledWith({
      where: { id: FAKE_JOB_ID },
      data: expect.objectContaining({
        conversionUploadStatus: "failed",
        conversionUploadError:  expect.stringMatching(/rate limit/i),
      }),
    });
  });
});

// ── Job.gclid path still works (web-form-led jobs) ─────────────────────────

describe("End-to-end loop — Job.gclid path (web-form-led job)", () => {
  it("uploads using Job.gclid directly when present (no CallIntent fallback needed)", async () => {
    const WEB_GCLID = "web-form-gclid-xyz";
    jobFindUnique.mockResolvedValueOnce({
      id: FAKE_JOB_ID, jobNumber: FAKE_JOB_NUMBER,
      gclid: WEB_GCLID,
      conversionUploadStatus: null, conversionUploadedAt: null,
      workCompletedAt: new Date("2026-05-26T14:00:00Z"),
      signedAt: null, acceptedAt: null,
      assessmentFee: 0, quote: { total: 175 },
    });

    googleAdsRequestMock.mockResolvedValueOnce({ results: [{ gclid: WEB_GCLID }] });

    const result = await uploadJobConversionIfEligible(FAKE_JOB_ID);

    expect(result.ok).toBe(true);
    expect(googleAdsRequestMock.mock.calls[0][2].conversions[0].gclid).toBe(WEB_GCLID);

    // Should NOT have queried VoiceCall when Job.gclid was already set —
    // fall-through only kicks in when gclid is null
    expect(voiceCallFindFirst).not.toHaveBeenCalled();
    expect(callIntentFindFirst).not.toHaveBeenCalled();
  });
});
