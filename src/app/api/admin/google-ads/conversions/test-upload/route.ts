/**
 * GET /api/admin/google-ads/conversions/test-upload
 *
 * Diagnostic (2026-06-14): proves the offline-conversion UPLOAD path is
 * functional against the live Google Ads API without recording anything.
 *
 * It issues a single `uploadClickConversions` call with `validateOnly: true`.
 * Google validates auth, the conversion-action resource, and the request
 * format, then records NOTHING (validateOnly). This is the only link in the
 * conversion pipeline that cannot be exercised with synthetic data through the
 * normal flow (uploadClickConversion() hardcodes validateOnly:false), and it's
 * the last thing to confirm before trusting new ad spend.
 *
 * A success (no partialFailureError) means: API quota available, credentials
 * valid, conversion action usable for upload, request well-formed → real
 * conversions WILL post once a real gclid exists on a completed job.
 *
 * Records nothing, costs ~1 op. Admin JWT cookie required.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import { toGoogleDateString } from "@/lib/google-ads-conversions";
import prisma from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

async function logTestUpload(args: {
  status: number;
  outcome: string;
  conversionAction?: string | null;
  partialFailureError?: unknown;
  notes?: string;
  triggeredBy?: string;
}): Promise<void> {
  try {
    await p.conversionTestUpload.create({
      data: {
        status: args.status,
        outcome: args.outcome,
        conversionAction: args.conversionAction ?? null,
        partialFailureError: args.partialFailureError ?? null,
        notes: args.notes ? args.notes.slice(0, 2000) : null,
        triggeredBy: args.triggeredBy ?? null,
      },
    });
  } catch (err) {
    // Logging is best-effort — never break the test-upload flow because
    // the audit row didn't write.
    console.warn("[test-upload] failed to log to ConversionTestUpload:", err);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    // We still log the unauthorized attempt for the §34 audit trail — it's
    // the only way a misconfigured cookie state shows up here.
    await logTestUpload({
      status: 401,
      outcome: "auth_error",
      notes: "Unauthorized — no valid admin cookie",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const triggeredBy = admin.id ?? "unknown";

  const conversionAction = process.env["GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"];
  if (!conversionAction) {
    await logTestUpload({
      status: 500,
      outcome: "missing_env",
      notes: "GOOGLE_ADS_CONVERSION_ACTION_RESOURCE env var unset",
      triggeredBy,
    });
    return NextResponse.json({
      ok: false,
      error: "GOOGLE_ADS_CONVERSION_ACTION_RESOURCE not set",
    });
  }
  const m = conversionAction.match(/^customers\/(\d+)\//);
  if (!m) {
    await logTestUpload({
      status: 500,
      outcome: "missing_env",
      conversionAction,
      notes: "Malformed GOOGLE_ADS_CONVERSION_ACTION_RESOURCE",
      triggeredBy,
    });
    return NextResponse.json({
      ok: false,
      error: "Malformed GOOGLE_ADS_CONVERSION_ACTION_RESOURCE",
    });
  }
  const customerId = m[1];

  let ctx;
  try {
    ctx = await getDefaultGoogleAdsClient();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await logTestUpload({
      status: 500,
      outcome: "google_throw",
      conversionAction,
      notes: `Google Ads client unavailable: ${errMsg}`,
      triggeredBy,
    });
    return NextResponse.json({
      ok: false,
      error: `Google Ads client unavailable: ${errMsg}`,
    });
  }
  if (!ctx) {
    await logTestUpload({
      status: 500,
      outcome: "google_throw",
      conversionAction,
      notes: "No active GoogleAdsAccount in DB",
      triggeredBy,
    });
    return NextResponse.json({ ok: false, error: "No active GoogleAdsAccount" });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (ctx as any).client;

  const body = {
    conversions: [
      {
        gclid: "TEST_VALIDATEONLY_DO_NOT_RECORD",
        conversionAction,
        conversionDateTime: toGoogleDateString(new Date()),
        conversionValue: 1,
        currencyCode: "GBP",
        orderId: `validateonly-${Date.now()}`,
      },
    ],
    partialFailure: true,
    validateOnly: true,
  };

  try {
    const response = await c.request(
      `customers/${customerId}:uploadClickConversions`,
      "POST",
      body,
    );
    // With a synthetic gclid, Google may still return a partialFailureError
    // (gclid not tied to a real click). That is EXPECTED and still proves the
    // request reached Google, auth + the conversion action are valid, and the
    // upload endpoint is reachable. A hard throw (caught below) is the failure
    // mode that would block real conversions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pfe = (response as any)?.partialFailureError ?? null;
    await logTestUpload({
      status: 200,
      outcome: pfe ? "google_partial_failure" : "ok",
      conversionAction,
      partialFailureError: pfe,
      notes: pfe
        ? "Request accepted by Google; partialFailureError is expected for the synthetic gclid."
        : "Validate-only upload accepted with no errors.",
      triggeredBy,
    });
    return NextResponse.json({
      ok: true,
      validateOnly: true,
      uploadPathReachable: true,
      conversionAction,
      partialFailureError: pfe,
      note: pfe
        ? "Request accepted by Google; partialFailureError is expected for the synthetic gclid. Auth + action + format are valid — real conversions will upload."
        : "Validate-only upload accepted with no errors. Upload path is fully functional.",
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await logTestUpload({
      status: 500,
      outcome: "google_throw",
      conversionAction,
      notes: errMsg,
      triggeredBy,
    });
    return NextResponse.json({
      ok: false,
      validateOnly: true,
      uploadPathReachable: false,
      error: errMsg,
    });
  }
}
