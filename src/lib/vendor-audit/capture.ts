/**
 * Universal capture layer. Two entry points:
 *
 *   1. vendorFetch(url, init, opts?) — drop-in replacement for fetch()
 *      that logs request + response metadata to VendorEvent.
 *
 *   2. recordSdkCall(evt) — for vendors we drive through an SDK (e.g.
 *      Stripe, Resend) where we don't see the raw HTTP. The SDK call
 *      site computes vendor/endpoint/status/etc and hands them in.
 *
 *   3. withVendorAudit(vendor, handler) — wraps a webhook route handler
 *      so the inbound HTTP request is logged regardless of outcome.
 *
 * All three are best-effort: a failure inside the audit layer never
 * propagates out to the caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { canonicalEndpoint, classifyVendor } from "./classify";
import { extractIdentifiers, tryParseBody } from "./identifiers";
import { classifyPayload } from "./field-catalog";
import { recordVendorEvent } from "./store";
import type { VendorEventCapture, VendorId, Direction } from "./types";

interface VendorFetchOpts {
  vendor?:      VendorId;
  callerRoute?: string;
  jobId?:       string;
  customerId?:  string;
  /** Skip capture entirely — for hot paths that opt out. */
  skipAudit?:   boolean;
}

/**
 * Drop-in fetch wrapper. Returns the original Response untouched.
 * Body is cloned so the caller can still consume it.
 */
export async function vendorFetch(
  input:  RequestInfo | URL,
  init?:  RequestInit,
  opts?:  VendorFetchOpts,
): Promise<Response> {
  if (opts?.skipAudit) return fetch(input, init);

  const url = typeof input === "string"
    ? input
    : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? "GET").toUpperCase();
  const vendor = opts?.vendor ?? classifyVendor(url);
  const endpoint = canonicalEndpoint(url);

  // Capture the outbound body for identifier extraction.
  let reqBodyStr: string | undefined;
  if (init?.body) {
    try {
      if (typeof init.body === "string") reqBodyStr = init.body;
      else if (init.body instanceof URLSearchParams) reqBodyStr = init.body.toString();
      else if (init.body instanceof FormData) {
        // Best-effort flatten of FormData entries
        const parts: string[] = [];
        for (const [k, v] of (init.body as FormData).entries()) {
          parts.push(`${k}=${typeof v === "string" ? v : "[blob]"}`);
        }
        reqBodyStr = parts.join("&");
      }
    } catch { /* ignore */ }
  }
  const reqBytes = reqBodyStr ? Buffer.byteLength(reqBodyStr) : undefined;

  const t0 = Date.now();
  let response: Response | null = null;
  let errorMessage: string | undefined;
  try {
    response = await fetch(input, init);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  const latencyMs = Date.now() - t0;

  // Clone before reading so caller still gets a fresh body.
  let resBodyStr: string | undefined;
  let resBytes:   number | undefined;
  if (response) {
    try {
      const clone = response.clone();
      resBodyStr = await clone.text();
      resBytes   = Buffer.byteLength(resBodyStr);
    } catch { /* ignore */ }
  }

  const reqParsed = tryParseBody(reqBodyStr);
  const resParsed = tryParseBody(resBodyStr);

  const evt: VendorEventCapture = {
    vendor,
    direction:     "outbound",
    endpoint,
    method,
    status:        response?.status,
    requestBytes:  reqBytes,
    responseBytes: resBytes,
    latencyMs,
    identifiersShared:   reqParsed ? extractIdentifiers(reqParsed) : undefined,
    identifiersReceived: resParsed ? extractIdentifiers(resParsed) : undefined,
    fieldsShared:        classifyPayload(reqParsed, vendor) ?? undefined,
    fieldsReceived:      classifyPayload(resParsed, vendor) ?? undefined,
    requestSample:  reqBodyStr,
    responseSample: resBodyStr,
    callerRoute: opts?.callerRoute,
    jobId:       opts?.jobId,
    customerId:  opts?.customerId,
    errorMessage,
  };
  recordVendorEvent(evt);

  if (!response) {
    // Re-throw the underlying network error so callers behave normally.
    throw new Error(errorMessage ?? "vendorFetch: network error");
  }
  return response;
}

/**
 * Record an SDK-driven vendor call. Use this when fetch is hidden inside
 * a library (Stripe, Resend, Twilio SDK). Caller computes everything.
 */
export function recordSdkCall(
  vendor:    VendorId,
  direction: Direction,
  endpoint:  string,
  details:   Omit<VendorEventCapture, "vendor" | "direction" | "endpoint">,
): void {
  recordVendorEvent({ vendor, direction, endpoint, ...details });
}

/**
 * Wrap an inbound webhook handler. Captures method, path, byte counts,
 * extracted identifiers, response status. Use:
 *
 *   export const POST = withVendorAudit("stripe", async (req) => { ... });
 */
type RouteHandlerIn  = (req: NextRequest) => Promise<Response> | Response;
type RouteHandlerOut = (req: NextRequest) => Promise<Response>;
export function withVendorAudit(
  vendor: VendorId,
  handler: RouteHandlerIn,
): RouteHandlerOut {
  return async (req: NextRequest): Promise<Response> => {
    const t0 = Date.now();
    let reqBodyStr: string | undefined;
    try {
      const cloned = req.clone();
      reqBodyStr = await cloned.text();
    } catch { /* ignore */ }
    const reqBytes  = reqBodyStr ? Buffer.byteLength(reqBodyStr) : undefined;
    const reqParsed = tryParseBody(reqBodyStr);

    let response: Response;
    let errorMessage: string | undefined;
    try {
      response = await handler(req);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      response = NextResponse.json({ error: "handler failed" }, { status: 500 });
    }
    const latencyMs = Date.now() - t0;

    let resBodyStr: string | undefined;
    let resBytes:   number | undefined;
    try {
      const clone = response.clone();
      resBodyStr = await clone.text();
      resBytes   = Buffer.byteLength(resBodyStr);
    } catch { /* ignore */ }

    const resParsed = tryParseBody(resBodyStr);
    recordVendorEvent({
      vendor,
      direction:    "inbound",
      endpoint:     canonicalEndpoint(req.url),
      method:       req.method.toUpperCase(),
      status:       response.status,
      requestBytes: reqBytes,
      responseBytes: resBytes,
      latencyMs,
      identifiersShared:   reqParsed ? extractIdentifiers(reqParsed) : undefined,
      identifiersReceived: resParsed ? extractIdentifiers(resParsed) : undefined,
      // Inbound: "shared with us" by the vendor.
      fieldsReceived: classifyPayload(reqParsed, vendor) ?? undefined,
      fieldsShared:   classifyPayload(resParsed, vendor) ?? undefined,
      requestSample:  reqBodyStr,
      responseSample: resBodyStr,
      callerRoute:    new URL(req.url).pathname,
      errorMessage,
    });

    if (errorMessage) throw new Error(errorMessage);
    return response;
  };
}
